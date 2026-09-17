// ES module. Because module scripts are deferred, this runs AFTER every classic
// <script> in index.html — which is exactly what makes the localStorage-first
// boot path in storage.js safe to leave untouched.
const FIREBASE_SDK_VERSION = "11.0.2";
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

const readyCallbacks = [];
let resolveReady;
const ready = new Promise((resolve) => { resolveReady = resolve; });

const VCT = Object.assign(window.VCT || {}, {
  app: null,
  auth: null,
  db: null,
  fx: null,
  uid: null,
  ready,
  onReady(fn) {
    if (VCT.uid) fn(VCT.uid);
    else readyCallbacks.push(fn);
  },
});

window.VCT = VCT;

try {
  const firebaseApp = await import(`${CDN}/firebase-app.js`);
  const firebaseAuth = await import(`${CDN}/firebase-auth.js`);
  const ax = firebaseAuth;
  const fx = await import(`${CDN}/firebase-firestore.js`);

  const { initializeApp } = firebaseApp;
  const { getAuth, signInAnonymously, onAuthStateChanged } = firebaseAuth;
  const {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
  } = fx;

  const firebaseConfig = {
    apiKey: "AIzaSyDNJ8C9ThiMLnEyKoF6WTTHmpe-aeWU-74",
    authDomain: "valorant-challenge-tracker.firebaseapp.com",
    projectId: "valorant-challenge-tracker",
    storageBucket: "valorant-challenge-tracker.firebasestorage.app",
    messagingSenderId: "258118916399",
    appId: "1:258118916399:web:0424f20a1900f60049a9da",
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  // persistentMultipleTabManager is required: the tracker is the kind of app
  // people leave open in a second tab, and the single-tab default would throw there.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  Object.assign(VCT, { app, auth, db, fx, ax });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("VCT: anonymous sign-in failed", err);
        // The app keeps working on localStorage alone. This is a degraded
        // mode, not a failure state.
        if (typeof window.showAppNotice === "function") {
          window.showAppNotice(
            "Cloud sync is unavailable right now. Your data is still saved in this browser.",
            "Offline mode"
          );
        }
      }
      return;
    }
    const first = VCT.uid === null;
    VCT.uid = user.uid;
    VCT.isAnonymous = user.isAnonymous;
    if (first) {
      resolveReady(user.uid);
      while (readyCallbacks.length) {
        try {
          readyCallbacks.shift()(user.uid);
        } catch (cbErr) {
          console.error("VCT: onReady callback error", cbErr);
        }
      }
    }
    window.dispatchEvent(new CustomEvent("vct:auth", { detail: { user } }));
  });
} catch (err) {
  console.warn("VCT: Firebase SDK unavailable or offline", err);
  if (typeof window.showAppNotice === "function") {
    window.showAppNotice(
      "Cloud sync is unavailable right now. Your data is still saved in this browser.",
      "Offline mode"
    );
  }
}

VCT.onReady(async (uid) => {
  try {
    const migrator = VCT.migrate || window.VCTMigrate;
    if (migrator && typeof migrator.run === "function") {
      const result = await migrator.run(uid);
      if (result && result.migrated && typeof window.showToast === "function") {
        window.showToast(
          `${result.challengeCount} challenge${result.challengeCount === 1 ? "" : "s"} moved to your account.`
        );
      }
    }
  } catch (err) {
    console.error("VCT: migration failed", err);
    if (typeof window.showAppNotice === "function") {
      window.showAppNotice(
        "Your existing data could not be moved to the cloud yet. It is still safe in this browser, and we will retry next time you open the tracker.",
        "Migration postponed"
      );
    }
  }
  const cloud = VCT.cloud || (window.VCT && window.VCT.cloud);
  if (cloud && typeof cloud.start === "function") cloud.start(uid);
});
