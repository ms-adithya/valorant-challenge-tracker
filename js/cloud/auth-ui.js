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

    // Inert stubs for Task 9: prevents default submission/navigation without invoking remote auth APIs
    const authForm = document.getElementById("authForm");
    if (authForm) {
      authForm.addEventListener("submit", (e) => {
        e.preventDefault();
      });
    }

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
  };

  if (typeof window !== "undefined") {
    Object.assign(window, api);
    window.VCTAuthUI = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
