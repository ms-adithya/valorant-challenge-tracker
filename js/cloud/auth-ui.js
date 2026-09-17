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
      host.innerHTML = `<p class="auth-offline">Working offline</p>`;
      return;
    }

    const user = VCT.auth.currentUser;

    // If Auth is initialized with no user: render signed-out state
    if (!user) {
      host.innerHTML = `
        <button class="ghost" type="button" id="openSignUpBtn">Create an account</button>
        <button class="linklike" type="button" id="openSignInBtn">I already have one</button>`;
      const signUpBtn = document.getElementById("openSignUpBtn");
      const signInBtn = document.getElementById("openSignInBtn");
      if (signUpBtn) signUpBtn.onclick = () => openAuthModal("signup");
      if (signInBtn) signInBtn.onclick = () => openAuthModal("signin");
      return;
    }

    // Anonymous user
    if (user.isAnonymous) {
      host.innerHTML = `
        <p class="auth-anon">Your data is saved on this device only.</p>
        <button class="ghost" type="button" id="openSignUpBtn">Create an account</button>
        <button class="linklike" type="button" id="openSignInBtn">I already have one</button>`;
      const signUpBtn = document.getElementById("openSignUpBtn");
      const signInBtn = document.getElementById("openSignInBtn");
      if (signUpBtn) signUpBtn.onclick = () => openAuthModal("signup");
      if (signInBtn) signInBtn.onclick = () => openAuthModal("signin");
      return;
    }

    // Authenticated named user
    const label = user.displayName || user.email || "Signed in";
    host.innerHTML = `
      <p class="auth-user">${escapeHtml(label)}</p>
      <button class="linklike" type="button" id="signOutBtn">Sign out</button>`;
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

  async function signOut() {
    const confirmFn = typeof window.appConfirm === "function" ? window.appConfirm : async () => true;
    if (!await confirmFn({
      title: "Sign out?",
      message: "Your challenges stay in your account. This device will start a fresh local session.",
      confirmText: "Sign out",
      kicker: "ACCOUNT",
    })) return;

    const VCT = root.VCT || window.VCT;
    if (VCT && VCT.ax && typeof VCT.ax.signOut === "function" && VCT.auth) {
      await VCT.ax.signOut(VCT.auth);
    }
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

    // Google remains an inert stub for Task 10 (deferred to Task 11)
    const googleBtn = document.getElementById("googleSignInBtn");
    if (googleBtn) {
      googleBtn.addEventListener("click", (e) => {
        e.preventDefault();
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
    handleEmailAuth,
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
