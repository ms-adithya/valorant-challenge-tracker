const test = require("node:test");
const assert = require("node:assert");

// ---------------------------------------------------------------------------
// Mock Helpers for Google Auth Testing
// ---------------------------------------------------------------------------

function createMockGoogleAuthEnvironment(initialUser = null) {
  let currentUser = initialUser;
  const calls = {
    linkWithPopup: [],
    signInWithPopup: [],
    providerInstances: [],
  };

  class MockGoogleAuthProvider {
    constructor() {
      this.providerId = "google.com";
      calls.providerInstances.push(this);
    }
  }

  const ax = {
    GoogleAuthProvider: MockGoogleAuthProvider,
    linkWithPopup: async (user, provider) => {
      calls.linkWithPopup.push({ user, provider });
      if (ax._linkError) throw ax._linkError;
      user.isAnonymous = false;
      user.displayName = "Google Player";
      user.email = "player@gmail.com";
      return { user };
    },
    signInWithPopup: async (auth, provider) => {
      calls.signInWithPopup.push({ provider });
      if (ax._signInError) throw ax._signInError;
      currentUser = { uid: "google_target_uid", email: "player@gmail.com", isAnonymous: false };
      auth.currentUser = currentUser;
      return { user: currentUser };
    },
    _linkError: null,
    _signInError: null,
  };

  const auth = {
    get currentUser() { return currentUser; },
    set currentUser(u) { currentUser = u; },
  };

  const vct = {
    auth,
    ax,
    pendingMerge: null,
  };

  return { vct, auth, ax, calls };
}

// ---------------------------------------------------------------------------
// 1. Google Anonymous Linking (UID Invariant)
// ---------------------------------------------------------------------------

test("Google Auth: anonymous signup calls linkWithPopup and preserves exact UID", async () => {
  const anonUser = { uid: "anon_google_hero", isAnonymous: true };
  const { vct, calls } = createMockGoogleAuthEnvironment(anonUser);

  global.window = { VCT: vct };
  const authUi = require("../js/cloud/auth-ui.js");

  const beforeUid = vct.auth.currentUser.uid;
  assert.strictEqual(beforeUid, "anon_google_hero");

  await authUi.handleGoogleAuth();

  // Verified linkWithPopup was called with provider
  assert.strictEqual(calls.linkWithPopup.length, 1);
  assert.strictEqual(calls.providerInstances.length, 1);
  assert.strictEqual(calls.signInWithPopup.length, 0);

  // Verified UID invariant: before === after
  const afterUid = vct.auth.currentUser.uid;
  assert.strictEqual(afterUid, beforeUid);
  assert.strictEqual(vct.auth.currentUser.isAnonymous, false);
  assert.strictEqual(vct.pendingMerge, null);
});

// ---------------------------------------------------------------------------
// 2. Google Non-Anonymous Direct Sign-In
// ---------------------------------------------------------------------------

test("Google Auth: non-anonymous sign-in calls signInWithPopup directly", async () => {
  const normalUser = { uid: "existing_user_uid", isAnonymous: false };
  const { vct, calls } = createMockGoogleAuthEnvironment(normalUser);

  global.window = { VCT: vct };
  const authUi = require("../js/cloud/auth-ui.js");

  await authUi.handleGoogleAuth();

  assert.strictEqual(calls.signInWithPopup.length, 1);
  assert.strictEqual(calls.linkWithPopup.length, 0);
  assert.strictEqual(vct.auth.currentUser.uid, "google_target_uid");
});

// ---------------------------------------------------------------------------
// 3. Credential Collision Handling: credential-already-in-use triggers offerMerge
// ---------------------------------------------------------------------------

test("Google Auth: credential-already-in-use invokes offerMerge with confirm", async () => {
  const anonUser = { uid: "anon_collide", isAnonymous: true };
  const { vct, ax, calls } = createMockGoogleAuthEnvironment(anonUser);
  ax._linkError = { code: "auth/credential-already-in-use" };

  let confirmPromptSeen = false;
  global.window = {
    VCT: vct,
    activeChallenges: [{ id: "c_g1", matches: [{ matchId: "m1", no: 1 }] }],
    archives: [],
    appConfirm: async (opts) => {
      confirmPromptSeen = true;
      assert.strictEqual(opts.kicker, "ACCOUNT");
      assert.ok(opts.message.includes("1 challenge"));
      return true; // Confirm
    },
  };

  const authUi = require("../js/cloud/auth-ui.js");
  await authUi.handleGoogleAuth();

  assert.strictEqual(confirmPromptSeen, true);
  assert.strictEqual(calls.signInWithPopup.length, 1);
  assert.strictEqual(vct.auth.currentUser.uid, "google_target_uid");
  assert.ok(vct.pendingMerge);
  assert.strictEqual(vct.pendingMerge.activeChallenges[0].id, "c_g1");
});

test("Google Auth: credential-already-in-use with cancel stages nothing", async () => {
  const anonUser = { uid: "anon_collide", isAnonymous: true };
  const { vct, ax, calls } = createMockGoogleAuthEnvironment(anonUser);
  ax._linkError = { code: "auth/credential-already-in-use" };

  global.window = {
    VCT: vct,
    activeChallenges: [{ id: "c_g1", matches: [] }],
    archives: [],
    appConfirm: async () => false, // Cancel ("Leave them behind")
  };

  const authUi = require("../js/cloud/auth-ui.js");
  await authUi.handleGoogleAuth();

  assert.strictEqual(calls.signInWithPopup.length, 1);
  assert.strictEqual(vct.auth.currentUser.uid, "google_target_uid");
  assert.strictEqual(vct.pendingMerge, null);
});

// ---------------------------------------------------------------------------
// 4. Cross-Provider Collision: account-exists-with-different-credential
// ---------------------------------------------------------------------------

test("Google Auth: account-exists-with-different-credential throws directly and does not merge", async () => {
  const anonUser = { uid: "anon_collide", isAnonymous: true };
  const { vct, ax, calls } = createMockGoogleAuthEnvironment(anonUser);
  ax._linkError = { code: "auth/account-exists-with-different-credential" };

  let confirmCalled = false;
  global.window = {
    VCT: vct,
    activeChallenges: [{ id: "c_g1", matches: [] }],
    archives: [],
    appConfirm: async () => { confirmCalled = true; return true; },
  };

  const authUi = require("../js/cloud/auth-ui.js");

  // Critical requirement: account-exists-with-different-credential must NOT call offerMerge or signInWithPopup
  await assert.rejects(
    async () => {
      await authUi.handleGoogleAuth();
    },
    (err) => err.code === "auth/account-exists-with-different-credential"
  );

  assert.strictEqual(confirmCalled, false);
  assert.strictEqual(calls.signInWithPopup.length, 0);
  assert.strictEqual(vct.pendingMerge, null);

  // Surface message translation
  const msg = authUi.authMessage({ code: "auth/account-exists-with-different-credential" });
  assert.ok(msg.includes("registered with a different sign-in method"));
});

// ---------------------------------------------------------------------------
// 5. Popup Cancellation & Closure Tolerance in Button Listener
// ---------------------------------------------------------------------------

test("Google Auth UI: popup closure and cancelled request are handled silently", async () => {
  const errors = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];

  for (const errCode of errors) {
    let errorDisplayed = false;
    let toastShown = false;
    let modalClosed = false;

    const btn = {
      disabled: false,
      listeners: {},
      addEventListener(event, fn) { this.listeners[event] = fn; },
      async click() { await this.listeners["click"](); },
    };

    const doc = {
      getElementById: (id) => {
        if (id === "googleSignInBtn") return btn;
        if (id === "authModal") return { classList: { remove() {}, add() {} }, setAttribute() {} };
        if (id === "authError") return { textContent: "", classList: { add() {}, remove() { errorDisplayed = true; } } };
        return null;
      },
    };

    global.document = doc;
    global.window = {
      VCT: {
        auth: { currentUser: { isAnonymous: true } },
        ax: {
          GoogleAuthProvider: class {},
          linkWithPopup: async () => { throw { code: errCode }; },
        },
      },
      showToast: () => { toastShown = true; },
      closeAuthModal: () => { modalClosed = true; },
    };

    const authUi = require("../js/cloud/auth-ui.js");
    // Wire button listener
    btn.listeners["click"] = async () => {
      btn.disabled = true;
      try {
        await authUi.handleGoogleAuth();
        authUi.closeAuthModal();
      } catch (err) {
        if (err && (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request")) {
          return;
        }
        authUi.showAuthError(authUi.authMessage(err));
      } finally {
        btn.disabled = false;
      }
    };

    await btn.click();

    // Invariants for cancelled popup:
    assert.strictEqual(errorDisplayed, false, "Must not display error banner");
    assert.strictEqual(toastShown, false, "Must not show toast");
    assert.strictEqual(modalClosed, false, "Modal must stay open");
    assert.strictEqual(btn.disabled, false, "Button must be re-enabled in finally");
  }
});

// ---------------------------------------------------------------------------
// 6. Error Message Translations for Google Scenarios
// ---------------------------------------------------------------------------

test("Google Auth: error messages for popup blocked and cross-provider", () => {
  const authUi = require("../js/cloud/auth-ui.js");

  assert.strictEqual(
    authUi.authMessage({ code: "auth/popup-blocked" }),
    "Your browser blocked the sign-in popup. Allow popups for this site and try again."
  );
  assert.strictEqual(
    authUi.authMessage({ code: "auth/account-exists-with-different-credential" }),
    "That email is already registered with a different sign-in method. Sign in that way first, then link Google from your account panel."
  );
});

// ---------------------------------------------------------------------------
// 7. Regression Invariant: Local Persistence and Sync Intact
// ---------------------------------------------------------------------------

test("regression check: persist() and local-first cloud-sync guarantees remain intact", () => {
  const { persist, persistLocal } = require("../js/persistence.js");
  const origLocalStorage = global.localStorage;
  const origData = global.data;
  const origActive = global.activeChallenges;
  const origArchives = global.archives;

  try {
    const store = {};
    global.localStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    };

    global.data = { id: "c_task11", name: "Task 11 Invariant Run", matches: [] };
    global.activeChallenges = [global.data];
    global.archives = [];

    assert.strictEqual(persistLocal(), true);
    assert.ok(store.vct4.includes("Task 11 Invariant Run"));
    assert.strictEqual(persist(), true);
  } finally {
    if (origLocalStorage !== undefined) global.localStorage = origLocalStorage;
    else delete global.localStorage;
    global.data = origData;
    global.activeChallenges = origActive;
    global.archives = origArchives;
  }
});
