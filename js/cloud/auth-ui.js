// Account panel and sign-in modal shell. Classic script; Firebase auth functions
// arrive via window.VCT.ax (set by firebase-boot.js).
(function (root) {
  let authMode = "signin";

  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderAuthState() {
    const host = document.getElementById("authState");
    if (!host) return;
    const VCT = root.VCT || window.VCT;
    
    // If Firebase/Auth is unavailable: render "Working offline"
    if (!VCT || !VCT.auth) {
      host.innerHTML = `
        <div class="auth-card-widget auth-offline-card">
          <div class="auth-widget-header">
            <div class="auth-avatar-badge offline">
              <span class="auth-avatar-icon">☁</span>
            </div>
            <div class="auth-user-meta">
              <div class="auth-title-line">
                <strong class="auth-display-name">Storage Status</strong>
                <span class="auth-pill pill-muted">Offline</span>
              </div>
              <p class="auth-offline">Working offline</p>
            </div>
          </div>
        </div>`;
      return;
    }

    const user = VCT.auth.currentUser;

    // If Auth is initialized with no user: render signed-out state
    if (!user) {
      host.innerHTML = `
        <div class="auth-card-widget">
          <div class="auth-widget-header" id="authWidgetHeader" title="Click to sign in">
            <div class="auth-avatar-badge guest">
              <span class="auth-avatar-icon">👤</span>
            </div>
            <div class="auth-user-meta">
              <div class="auth-title-line">
                <strong class="auth-display-name">Player Profile</strong>
                <span class="auth-pill pill-muted">Signed out</span>
              </div>
              <p class="auth-anon">Sign in to sync your match history</p>
            </div>
          </div>
          <div class="auth-widget-actions">
            <button class="auth-btn-primary" type="button" id="openSignUpBtn">
              <span class="auth-btn-icon">⚡</span>
              <span>Create an account</span>
            </button>
            <button class="auth-btn-secondary" type="button" id="openSignInBtn">
              <span>Sign In</span>
              <span class="auth-btn-hint">· I already have one</span>
            </button>
          </div>
        </div>`;
      const signUpBtn = document.getElementById("openSignUpBtn");
      const signInBtn = document.getElementById("openSignInBtn");
      const header = document.getElementById("authWidgetHeader");
      if (signUpBtn) signUpBtn.onclick = () => openAuthModal("signup");
      if (signInBtn) signInBtn.onclick = () => openAuthModal("signin");
      if (header) header.onclick = () => openAuthModal("signin");
      return;
    }

    // Anonymous user
    if (user.isAnonymous) {
      host.innerHTML = `
        <div class="auth-card-widget">
          <div class="auth-widget-header" id="authWidgetHeader" title="Guest session - click to sign in">
            <div class="auth-avatar-badge guest">
              <span class="auth-avatar-icon">👤</span>
            </div>
            <div class="auth-user-meta">
              <div class="auth-title-line">
                <strong class="auth-display-name">Guest Player</strong>
                <span class="auth-pill pill-amber">● Local</span>
              </div>
              <p class="auth-anon">Your data is saved on this device only.</p>
            </div>
          </div>
          <div class="auth-widget-actions">
            <button class="auth-btn-primary" type="button" id="openSignUpBtn">
              <span class="auth-btn-icon">⚡</span>
              <span>Create an account</span>
            </button>
            <button class="auth-btn-secondary" type="button" id="openSignInBtn">
              <span>Sign In</span>
              <span class="auth-btn-hint">· I already have one</span>
            </button>
          </div>
        </div>`;
      const signUpBtn = document.getElementById("openSignUpBtn");
      const signInBtn = document.getElementById("openSignInBtn");
      const header = document.getElementById("authWidgetHeader");
      if (signUpBtn) signUpBtn.onclick = () => openAuthModal("signup");
      if (signInBtn) signInBtn.onclick = () => openAuthModal("signin");
      if (header) header.onclick = () => openAuthModal("signin");
      return;
    }

    // Authenticated named user
    const label = user.displayName || user.email || "Signed in";
    const sublabel = user.displayName && user.email ? user.email : "Cloud Sync Active";
    const initial = (user.displayName || user.email || "P").charAt(0).toUpperCase();
    host.innerHTML = `
      <div class="auth-card-widget authenticated">
        <div class="auth-widget-header">
          <div class="auth-avatar-badge user">
            <span class="auth-avatar-initial">${escapeHtml(initial)}</span>
          </div>
          <div class="auth-user-meta">
            <div class="auth-title-line">
              <strong class="auth-display-name" title="${escapeHtml(label)}">${escapeHtml(label)}</strong>
              <span class="auth-pill pill-green">● Synced</span>
            </div>
            <p class="auth-user" title="${escapeHtml(sublabel)}">${escapeHtml(sublabel)}</p>
          </div>
        </div>
        <div class="auth-widget-actions">
          <button class="auth-btn-secondary auth-btn-signout" type="button" id="signOutBtn">
            <span class="auth-btn-icon">↩</span>
            <span>Sign out</span>
          </button>
        </div>
      </div>`;
    const signOutBtn = document.getElementById("signOutBtn");
    if (signOutBtn) signOutBtn.onclick = signOut;
  }

  function openAuthModal(mode) {
    authMode = mode;
    const modal = document.getElementById("authModal");
    if (!modal) return;
    const titleEl = document.getElementById("authModalTitle");
    const submitBtn = document.getElementById("authSubmitBtn");
    const switchText = document.getElementById("authSwitchText");
    const switchBtn = document.getElementById("authSwitchBtn");
    const passwordInput = document.getElementById("authPassword");
    const emailInput = document.getElementById("authEmail");

    if (titleEl) {
      titleEl.textContent = mode === "signup" ? "Create an account" : "Sign in";
    }
    if (submitBtn) {
      submitBtn.textContent = mode === "signup" ? "Create account" : "Sign in";
    }
    if (switchText) {
      switchText.textContent = mode === "signup" ? "Already have an account?" : "New here?";
    }
    if (switchBtn) {
      switchBtn.textContent = mode === "signup" ? "Sign in instead" : "Create an account";
    }
    if (passwordInput) {
      passwordInput.setAttribute(
        "autocomplete",
        mode === "signup" ? "new-password" : "current-password"
      );
    }

    clearAuthError();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    if (emailInput) {
      setTimeout(() => emailInput.focus(), 50);
    }
  }

  function closeAuthModal() {
    const modal = document.getElementById("authModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    const form = document.getElementById("authForm");
    if (form) form.reset();
    clearAuthError();
  }

  function showAuthError(message) {
    const box = document.getElementById("authError");
    if (!box) return;
    box.textContent = message;
    box.classList.remove("hidden");
  }

  function clearAuthError() {
    const box = document.getElementById("authError");
    if (!box) return;
    box.textContent = "";
    box.classList.add("hidden");
  }

  function purgeLocalSession() {
    const keys = ["vct4", "vctActiveChallenges", "vctArchives", "vct2"];
    const locStorage = (typeof localStorage !== "undefined" && localStorage) ||
      (typeof window !== "undefined" && window.localStorage) ||
      (root && root.localStorage);
    if (locStorage) {
      for (const k of keys) {
        try { locStorage.removeItem(k); } catch (_) {}
      }
    }
    const sessStorage = (typeof sessionStorage !== "undefined" && sessionStorage) ||
      (typeof window !== "undefined" && window.sessionStorage) ||
      (root && root.sessionStorage);
    if (sessStorage) {
      try {
        for (let i = (sessStorage.length || 0) - 1; i >= 0; i--) {
          const k = typeof sessStorage.key === "function" ? sessStorage.key(i) : null;
          if (k && (k.startsWith("vct") || k.startsWith("__vct"))) {
            sessStorage.removeItem(k);
          }
        }
      } catch (_) {}
    }
    const vct = (typeof window !== "undefined" && window.VCT) || (root && root.VCT) || null;
    if (vct) {
      vct.pendingMerge = null;
    }
  }

  async function signOut() {
    const confirmFn = (typeof window !== "undefined" && typeof window.appConfirm === "function")
      ? window.appConfirm
      : (typeof appConfirm === "function" ? appConfirm : async () => true);
    if (!await confirmFn({
      title: "Sign out?",
      message: "Your challenges stay in your account. This device will start a fresh local session.",
      confirmText: "Sign out",
      kicker: "ACCOUNT",
    })) return;

    const VCT = (typeof window !== "undefined" && window.VCT) || (root && root.VCT) || null;
    if (VCT && VCT.ax && typeof VCT.ax.signOut === "function" && VCT.auth) {
      await VCT.ax.signOut(VCT.auth);
    }
    purgeLocalSession();
    if (typeof window !== "undefined" && window.location && typeof window.location.reload === "function") {
      window.location.reload();
    }
  }

  const AUTH_MESSAGES = {
    "auth/invalid-email": "That email address does not look right.",
    "auth/missing-password": "Enter your password.",
    "auth/weak-password": "Choose a password of at least 6 characters.",
    "auth/email-already-in-use": "An account already uses that email. Try signing in instead.",
    "auth/invalid-credential": "That email and password do not match an account.",
    "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
    "auth/network-request-failed": "No connection. Your data is still saved on this device.",
    "auth/account-exists-with-different-credential": "That email is already registered with a different sign-in method. Sign in that way first, then link Google from your account panel.",
    "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups for this site and try again.",
  };

  function authMessage(err) {
    return AUTH_MESSAGES[err && err.code] ||
      "Something went wrong signing in. Your local data is untouched.";
  }

  // Shared by email (Task 10) and later Google (Task 11). `signInFn` performs provider sign-in.
  async function offerMerge(signInFn) {
    const vct = root.VCT || (typeof window !== "undefined" ? window.VCT : null);
    const getCanonicalActive = () => (typeof window !== "undefined" && window.activeChallenges) || (typeof activeChallenges !== "undefined" ? activeChallenges : []);
    const getCanonicalArchives = () => (typeof window !== "undefined" && window.archives) || (typeof archives !== "undefined" ? archives : []);

    const rawActive = getCanonicalActive();
    const rawArchives = getCanonicalArchives();
    const localCount = (rawActive ? rawActive.length : 0) + (rawArchives ? rawArchives.length : 0);

    let keepLocal = false;
    if (localCount > 0) {
      const confirmFn = typeof window !== "undefined" && typeof window.appConfirm === "function" ? window.appConfirm : async () => true;
      keepLocal = await confirmFn({
        title: "Keep this device's challenges?",
        message: `That account already exists. You have ${localCount} challenge${localCount === 1 ? "" : "s"} saved on this device. Add them to that account, or sign in and leave them behind?`,
        confirmText: "Add them to the account",
        cancelText: "Leave them behind",
        kicker: "ACCOUNT",
      });
    }

    // If confirmed: stage complete challenge objects including nested matches
    // If cancelled ("Leave them behind"): do NOT populate pendingMerge (stages nothing)
    if (keepLocal && vct) {
      vct.pendingMerge = {
        activeChallenges: JSON.parse(JSON.stringify(rawActive || [])),
        archives: JSON.parse(JSON.stringify(rawArchives || [])),
        applied: false,
      };
    }

    // Transactional staging: if sign-in fails, immediately clear pendingMerge
    try {
      await signInFn();
    } catch (err) {
      if (vct) vct.pendingMerge = null;
      throw err;
    }
  }

  async function handleEmailAuth(email, password, mode) {
    const vct = root.VCT || (typeof window !== "undefined" ? window.VCT : null);
    if (!vct || !vct.auth || !vct.ax) {
      throw new Error("Authentication is currently unavailable.");
    }
    const { auth, ax } = vct;
    const current = auth.currentUser;

    if (mode === "signup") {
      const credential = ax.EmailAuthProvider.credential(email, password);
      // Pathway A: Link rather than create: preserves the anonymous uid and every
      // document already written under it without needing a merge.
      if (current && current.isAnonymous) {
        try {
          await ax.linkWithCredential(current, credential);
          return;
        } catch (err) {
          // Pathway B: Credential collision
          if (err.code === "auth/credential-already-in-use" ||
              err.code === "auth/email-already-in-use") {
            await offerMerge(() => ax.signInWithEmailAndPassword(auth, email, password));
            return;
          }
          throw err;
        }
      }
      await ax.createUserWithEmailAndPassword(auth, email, password);
      return;
    }

    // Pathway C: Signing in as existing user from an anonymous session
    if (current && current.isAnonymous) {
      await offerMerge(() => ax.signInWithEmailAndPassword(auth, email, password));
      return;
    }
    await ax.signInWithEmailAndPassword(auth, email, password);
  }

  async function handleGoogleAuth() {
    const vct = root.VCT || (typeof window !== "undefined" ? window.VCT : null);
    if (!vct || !vct.auth || !vct.ax) {
      throw new Error("Authentication is currently unavailable.");
    }
    const { auth, ax } = vct;
    const provider = new ax.GoogleAuthProvider();
    const current = auth.currentUser;

    if (current && current.isAnonymous) {
      try {
        await ax.linkWithPopup(current, provider);
        return;
      } catch (err) {
        // Explicit distinction: credential-already-in-use triggers merge flow
        if (err.code === "auth/credential-already-in-use") {
          await offerMerge(() => ax.signInWithPopup(auth, provider));
          return;
        }
        // account-exists-with-different-credential or other errors are thrown directly
        // to surface the appropriate friendly error message without auto-merging
        throw err;
      }
    }
    await ax.signInWithPopup(auth, provider);
  }

  function wireListeners() {
    const closeBtn = document.getElementById("closeAuthModal");
    if (closeBtn) closeBtn.onclick = closeAuthModal;

    const switchBtn = document.getElementById("authSwitchBtn");
    if (switchBtn) {
      switchBtn.onclick = () => openAuthModal(authMode === "signup" ? "signin" : "signup");
    }

    const modal = document.getElementById("authModal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target.id === "authModal" || e.target.hasAttribute("data-auth-close")) {
          closeAuthModal();
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const m = document.getElementById("authModal");
        if (m && !m.classList.contains("hidden")) {
          closeAuthModal();
        }
      }
    });

    // Active submit handler for Task 10
    const authForm = document.getElementById("authForm");
    if (authForm) {
      authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearAuthError();
        const btn = document.getElementById("authSubmitBtn");
        const originalText = btn ? btn.textContent : "Submit";
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Working…";
        }
        try {
          const emailInput = document.getElementById("authEmail");
          const passwordInput = document.getElementById("authPassword");
          const email = emailInput ? emailInput.value.trim() : "";
          const password = passwordInput ? passwordInput.value : "";
          await handleEmailAuth(email, password, authMode);
          closeAuthModal();
          const showToastFn = typeof window !== "undefined" && typeof window.showToast === "function" ? window.showToast : null;
          if (showToastFn) {
            showToastFn(authMode === "signup" ? "Account created." : "Signed in.");
          }
        } catch (err) {
          console.error("VCT: auth failed", err);
          showAuthError(authMessage(err));
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
          }
        }
      });
    }

    // Active Google handler for Task 11
    const googleBtn = document.getElementById("googleSignInBtn");
    if (googleBtn) {
      googleBtn.addEventListener("click", async () => {
        clearAuthError();
        googleBtn.disabled = true;
        try {
          await handleGoogleAuth();
          closeAuthModal();
          const showToastFn = typeof window !== "undefined" && typeof window.showToast === "function" ? window.showToast : null;
          if (showToastFn) {
            showToastFn("Signed in with Google.");
          }
        } catch (err) {
          // Benign popup cancellation/closures are handled silently
          if (err && (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request")) {
            return;
          }
          console.error("VCT: Google auth failed", err);
          showAuthError(authMessage(err));
        } finally {
          googleBtn.disabled = false;
        }
      });
    }

    if (typeof window !== "undefined") {
      window.addEventListener("vct:auth", renderAuthState);
    }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        wireListeners();
        renderAuthState();
      });
    } else {
      wireListeners();
      renderAuthState();
    }
  }

  const api = {
    renderAuthState,
    openAuthModal,
    closeAuthModal,
    showAuthError,
    clearAuthError,
    getAuthMode: () => authMode,
    signOut,
    purgeLocalSession,
    handleEmailAuth,
    handleGoogleAuth,
    offerMerge,
    authMessage,
    AUTH_MESSAGES,
  };

  if (typeof window !== "undefined") {
    Object.assign(window, api);
    window.VCTAuthUI = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
