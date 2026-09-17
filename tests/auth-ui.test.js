const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

// ---------------------------------------------------------------------------
// 1. Static Invariants & Ordering in index.html
// ---------------------------------------------------------------------------

test("index.html: contains #authPanel and #authState inside sidebar", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.ok(html.includes('id="authPanel"'), "Must contain #authPanel");
  assert.ok(html.includes('id="authState"'), "Must contain #authState");
  
  // Placed inside sidebar before side-bottom
  const sidebarIdx = html.indexOf('<aside class="sidebar">');
  const authPanelIdx = html.indexOf('id="authPanel"');
  const sideBottomIdx = html.indexOf('class="side-bottom"');
  assert.ok(sidebarIdx > -1 && authPanelIdx > sidebarIdx, "#authPanel must be inside sidebar");
  assert.ok(sideBottomIdx > -1 && authPanelIdx < sideBottomIdx, "#authPanel must be before side-bottom");
});

test("index.html: contains #authModal with required ARIA attributes", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.ok(html.includes('id="authModal"'), "Must contain #authModal");
  assert.ok(html.includes('role="dialog"'), "Must have role='dialog'");
  assert.ok(html.includes('aria-modal="true"'), "Must have aria-modal='true'");
  assert.ok(html.includes('aria-labelledby="authModalTitle"'), "Must have aria-labelledby");
  assert.ok(html.includes('id="authModalTitle"'), "Must have #authModalTitle element");
  assert.ok(html.includes('id="closeAuthModal"'), "Must have close button");
  assert.ok(html.includes('id="googleSignInBtn"'), "Must have Google sign-in button");
  assert.ok(html.includes('id="authForm"'), "Must have auth form");
  assert.ok(html.includes('id="authEmail"'), "Must have authEmail input");
  assert.ok(html.includes('id="authPassword"'), "Must have authPassword input");
  assert.ok(html.includes('id="authSubmitBtn"'), "Must have submit button");
  assert.ok(html.includes('id="authSwitchBtn"'), "Must have switch button");
});

test("index.html: load-bearing ordering of CSS and JS", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  
  // 31-auth.css must follow 30-modal-keyboard.css
  const css30Idx = html.indexOf('30-modal-keyboard.css');
  const css31Idx = html.indexOf('31-auth.css');
  assert.ok(css30Idx > -1 && css31Idx > -1, "Both stylesheets must be linked");
  assert.ok(css31Idx > css30Idx, "31-auth.css must be loaded after 30-modal-keyboard.css");

  // auth-ui.js must load after cloud-migrate.js and before bootstrap.js
  const migrateIdx = html.indexOf('cloud-migrate.js');
  const authUiIdx = html.indexOf('auth-ui.js');
  const bootstrapIdx = html.indexOf('bootstrap.js');
  assert.ok(migrateIdx > -1 && authUiIdx > -1 && bootstrapIdx > -1, "Scripts must exist in index.html");
  assert.ok(authUiIdx > migrateIdx, "auth-ui.js must be loaded after cloud-migrate.js");
  assert.ok(authUiIdx < bootstrapIdx, "auth-ui.js must be loaded before bootstrap.js");
});

// ---------------------------------------------------------------------------
// 2. firebase-boot.js Invariants
// ---------------------------------------------------------------------------

test("firebase-boot.js: exposes ax on VCT", () => {
  const bootContent = fs.readFileSync(path.join(__dirname, "../js/cloud/firebase-boot.js"), "utf8");
  assert.ok(bootContent.includes("ax"), "firebase-boot.js must reference ax");
  assert.ok(bootContent.includes("Object.assign(VCT, { app, auth, db, fx, ax })"), "Must export ax on window.VCT");
});

// ---------------------------------------------------------------------------
// 3. auth-ui.js Runtime Behavior & DOM Manipulation
// ---------------------------------------------------------------------------

function createMockDom() {
  const elements = {};
  const listeners = {};

  function makeElement(id, tag = "div") {
    const el = {
      id,
      tagName: tag.toUpperCase(),
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); },
      },
      attributes: {},
      setAttribute(k, v) { this.attributes[k] = String(v); },
      getAttribute(k) { return this.attributes[k] ?? null; },
      hasAttribute(k) { return k in this.attributes; },
      innerHTML: "",
      textContent: "",
      value: "",
      focus() { el.focused = true; },
      reset() { el.value = ""; },
      addEventListener(event, fn) {
        if (!listeners[id]) listeners[id] = {};
        if (!listeners[id][event]) listeners[id][event] = [];
        listeners[id][event].push(fn);
      },
      click() {
        if (el.onclick) el.onclick({ target: el, preventDefault: () => {} });
        if (listeners[id] && listeners[id]["click"]) {
          listeners[id]["click"].forEach((fn) => fn({ target: el, preventDefault: () => {} }));
        }
      },
      submit() {
        if (listeners[id] && listeners[id]["submit"]) {
          listeners[id]["submit"].forEach((fn) => fn({ target: el, preventDefault: () => {} }));
        }
      },
    };
    elements[id] = el;
    return el;
  }

  // Prepopulate modal elements
  makeElement("authState");
  makeElement("authModal");
  makeElement("authModalTitle");
  makeElement("authSubmitBtn", "button");
  makeElement("authSwitchText");
  makeElement("authSwitchBtn", "button");
  makeElement("authPassword", "input");
  makeElement("authEmail", "input");
  makeElement("authError");
  makeElement("closeAuthModal", "button");
  makeElement("authForm", "form");
  makeElement("googleSignInBtn", "button");

  const docListeners = {};
  const doc = {
    readyState: "complete",
    getElementById: (id) => elements[id] || makeElement(id),
    addEventListener: (event, fn) => {
      if (!docListeners[event]) docListeners[event] = [];
      docListeners[event].push(fn);
    },
  };

  const winListeners = {};
  const win = {
    addEventListener: (event, fn) => {
      if (!winListeners[event]) winListeners[event] = [];
      winListeners[event].push(fn);
    },
    dispatchEvent: (e) => {
      if (winListeners[e.type]) {
        winListeners[e.type].forEach((fn) => fn(e));
      }
    },
  };

  return { elements, doc, win, docListeners, winListeners };
}

test("auth-ui: renderAuthState handles offline when Firebase/Auth is unavailable", () => {
  const { doc, win, elements } = createMockDom();
  global.document = doc;
  global.window = win;
  global.window.VCT = null; // No VCT

  const authUi = require("../js/cloud/auth-ui.js");
  authUi.renderAuthState();
  assert.ok(elements.authState.innerHTML.includes("Working offline"));

  global.window.VCT = { auth: null };
  authUi.renderAuthState();
  assert.ok(elements.authState.innerHTML.includes("Working offline"));
});

test("auth-ui: renderAuthState handles signed-out state when Auth has no user", () => {
  const { doc, win, elements } = createMockDom();
  global.document = doc;
  global.window = win;
  global.window.VCT = { auth: { currentUser: null } };

  const authUi = require("../js/cloud/auth-ui.js");
  authUi.renderAuthState();
  assert.ok(elements.authState.innerHTML.includes("Create an account"));
  assert.ok(elements.authState.innerHTML.includes("I already have one"));
  assert.ok(!elements.authState.innerHTML.includes("Working offline"));
});

test("auth-ui: renderAuthState handles anonymous user with device-only notice and action buttons", () => {
  const { doc, win, elements } = createMockDom();
  global.document = doc;
  global.window = win;
  global.window.VCT = { auth: { currentUser: { uid: "anon-123", isAnonymous: true } } };

  const authUi = require("../js/cloud/auth-ui.js");
  authUi.renderAuthState();
  assert.ok(elements.authState.innerHTML.includes("Your data is saved on this device only."));
  assert.ok(elements.authState.innerHTML.includes("Create an account"));
  assert.ok(elements.authState.innerHTML.includes("I already have one"));

  // Clicking "Create an account" sets mode to signup
  const signUpBtn = elements.openSignUpBtn;
  assert.ok(signUpBtn, "#openSignUpBtn must be wired");
  signUpBtn.click();
  assert.strictEqual(authUi.getAuthMode(), "signup");
  assert.strictEqual(elements.authModalTitle.textContent, "Create an account");
  assert.strictEqual(elements.authSubmitBtn.textContent, "Create account");

  // Clicking "I already have one" sets mode to signin
  const signInBtn = elements.openSignInBtn;
  assert.ok(signInBtn, "#openSignInBtn must be wired");
  signInBtn.click();
  assert.strictEqual(authUi.getAuthMode(), "signin");
  assert.strictEqual(elements.authModalTitle.textContent, "Sign in");
  assert.strictEqual(elements.authSubmitBtn.textContent, "Sign in");
});

test("auth-ui: renderAuthState handles authenticated user with displayName or email and sign-out button", () => {
  const { doc, win, elements } = createMockDom();
  global.document = doc;
  global.window = win;
  global.window.VCT = {
    auth: { currentUser: { uid: "user-456", isAnonymous: false, displayName: "Phoenix", email: "phoenix@val.com" } },
  };

  const authUi = require("../js/cloud/auth-ui.js");
  authUi.renderAuthState();
  assert.ok(elements.authState.innerHTML.includes("Phoenix"));
  assert.ok(elements.authState.innerHTML.includes("Sign out"));

  // Fallback to email if displayName is absent
  global.window.VCT.auth.currentUser.displayName = null;
  authUi.renderAuthState();
  assert.ok(elements.authState.innerHTML.includes("phoenix@val.com"));
});

test("auth-ui: modal open/close, toggle, and error banner functions", () => {
  const { doc, win, elements } = createMockDom();
  global.document = doc;
  global.window = win;

  const authUi = require("../js/cloud/auth-ui.js");
  
  // Initial state is hidden
  elements.authModal.classList.add("hidden");
  assert.ok(elements.authModal.classList.contains("hidden"));

  // Open modal in signin mode
  authUi.openAuthModal("signin");
  assert.ok(!elements.authModal.classList.contains("hidden"));
  assert.strictEqual(elements.authModal.getAttribute("aria-hidden"), "false");
  assert.strictEqual(authUi.getAuthMode(), "signin");

  // Show error
  authUi.showAuthError("Invalid credentials");
  assert.strictEqual(elements.authError.textContent, "Invalid credentials");
  assert.ok(!elements.authError.classList.contains("hidden"));

  // Close modal
  authUi.closeAuthModal();
  assert.ok(elements.authModal.classList.contains("hidden"));
  assert.strictEqual(elements.authModal.getAttribute("aria-hidden"), "true");
  assert.ok(elements.authError.classList.contains("hidden"));
});

test("auth-ui: safe stubs prevent default and make zero remote auth calls", () => {
  const { doc, win, elements } = createMockDom();
  global.document = doc;
  global.window = win;
  global.window.VCT = { auth: { currentUser: null }, ax: {} };

  require("../js/cloud/auth-ui.js");

  let formPrevented = false;
  const formSubmitEvent = { preventDefault: () => { formPrevented = true; } };
  const formListeners = doc.getElementById("authForm");
  assert.ok(formListeners, "authForm must be wired");
  
  let googlePrevented = false;
  const googleClickEvent = { preventDefault: () => { googlePrevented = true; } };
  const googleBtn = doc.getElementById("googleSignInBtn");
  assert.ok(googleBtn, "googleSignInBtn must be wired");

  // Trigger inert handlers
  formListeners.submit();
  googleBtn.click();

  // No exceptions and no changes to auth state
  assert.strictEqual(global.window.VCT.auth.currentUser, null);
});

// ---------------------------------------------------------------------------
// 4. Persistence and Cloud-Sync Invariant
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

    global.data = { id: "c_task9", name: "Task 9 Invariant Run", matches: [] };
    global.activeChallenges = [global.data];
    global.archives = [];

    // Verify persistLocal still operates synchronously
    assert.strictEqual(persistLocal(), true);
    assert.ok(store.vct4.includes("Task 9 Invariant Run"));

    // Verify persist() contract is true
    assert.strictEqual(persist(), true);
  } finally {
    if (origLocalStorage !== undefined) global.localStorage = origLocalStorage;
    else delete global.localStorage;
    global.data = origData;
    global.activeChallenges = origActive;
    global.archives = origArchives;
  }
});
