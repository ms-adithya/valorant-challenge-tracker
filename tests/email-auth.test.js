const test = require("node:test");
const assert = require("node:assert");

// ---------------------------------------------------------------------------
// Mock Helpers for Auth Testing
// ---------------------------------------------------------------------------

function createMockAuthEnvironment(initialUser = null) {
  let currentUser = initialUser;
  const calls = {
    linkWithCredential: [],
    signInWithEmailAndPassword: [],
    createUserWithEmailAndPassword: [],
  };

  const ax = {
    EmailAuthProvider: {
      credential: (email, password) => ({ providerId: "password", email, password }),
    },
    linkWithCredential: async (user, credential) => {
      calls.linkWithCredential.push({ user, credential });
      if (ax._linkError) throw ax._linkError;
      user.isAnonymous = false;
      user.email = credential.email;
      return { user };
    },
    signInWithEmailAndPassword: async (auth, email, password) => {
      calls.signInWithEmailAndPassword.push({ email, password });
      if (ax._signInError) throw ax._signInError;
      currentUser = { uid: "target_account_uid", email, isAnonymous: false };
      auth.currentUser = currentUser;
      return { user: currentUser };
    },
    createUserWithEmailAndPassword: async (auth, email, password) => {
      calls.createUserWithEmailAndPassword.push({ email, password });
      if (ax._createError) throw ax._createError;
      currentUser = { uid: "new_account_uid", email, isAnonymous: false };
      auth.currentUser = currentUser;
      return { user: currentUser };
    },
    _linkError: null,
    _signInError: null,
    _createError: null,
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
// 1. Pathway A: Anonymous Signup (UID Invariant)
// ---------------------------------------------------------------------------

test("Pathway A: anonymous signup calls linkWithCredential and preserves exact UID", async () => {
  const anonUser = { uid: "anon_alice_123", isAnonymous: true };
  const { vct, calls } = createMockAuthEnvironment(anonUser);

  global.window = { VCT: vct };
  const authUi = require("../js/cloud/auth-ui.js");

  const beforeUid = vct.auth.currentUser.uid;
  assert.strictEqual(beforeUid, "anon_alice_123");

  await authUi.handleEmailAuth("alice@example.com", "secret123", "signup");

  // Verified linkWithCredential was called
  assert.strictEqual(calls.linkWithCredential.length, 1);
  assert.strictEqual(calls.linkWithCredential[0].credential.email, "alice@example.com");
  assert.strictEqual(calls.createUserWithEmailAndPassword.length, 0);

  // Verified UID invariant: before === after
  const afterUid = vct.auth.currentUser.uid;
  assert.strictEqual(afterUid, beforeUid);
  assert.strictEqual(vct.auth.currentUser.isAnonymous, false);
  assert.strictEqual(vct.pendingMerge, null); // No merge staged
});

test("Pathway A: non-anonymous signup calls createUserWithEmailAndPassword", async () => {
  const { vct, calls } = createMockAuthEnvironment(null); // No user
  global.window = { VCT: vct };
  const authUi = require("../js/cloud/auth-ui.js");

  await authUi.handleEmailAuth("newuser@example.com", "secret123", "signup");
  assert.strictEqual(calls.createUserWithEmailAndPassword.length, 1);
  assert.strictEqual(calls.linkWithCredential.length, 0);
  assert.strictEqual(vct.auth.currentUser.uid, "new_account_uid");
});

// ---------------------------------------------------------------------------
// 2. Pathway B: Credential Collision Handling
// ---------------------------------------------------------------------------

test("Pathway B: collision with merge confirmation stages complete challenges + matches", async () => {
  const anonUser = { uid: "anon_bob_456", isAnonymous: true };
  const { vct, ax, calls } = createMockAuthEnvironment(anonUser);
  ax._linkError = { code: "auth/email-already-in-use" };

  const testChallenge = {
    id: "c_local_1",
    name: "Local Run",
    matches: [
      { matchId: "m_loc_1", no: 1, agent: "Jett", map: "Ascent", result: "Win", myScore: 13, enemyScore: 5 },
    ],
  };
  const testArchive = {
    id: "c_arc_1",
    name: "Old Run",
    archivedAt: "2026-01-01T00:00:00.000Z",
    matches: [{ matchId: "m_arc_1", no: 1, agent: "Sova", map: "Haven" }],
  };

  let confirmPromptSeen = false;
  global.window = {
    VCT: vct,
    activeChallenges: [testChallenge],
    archives: [testArchive],
    appConfirm: async (opts) => {
      confirmPromptSeen = true;
      assert.strictEqual(opts.kicker, "ACCOUNT");
      assert.ok(opts.message.includes("2 challenges"));
      return true; // Confirm "Add them to the account"
    },
  };

  const authUi = require("../js/cloud/auth-ui.js");
  await authUi.handleEmailAuth("bob@example.com", "secret123", "signup");

  assert.strictEqual(confirmPromptSeen, true);
  assert.strictEqual(calls.signInWithEmailAndPassword.length, 1);
  assert.strictEqual(vct.auth.currentUser.uid, "target_account_uid");

  // Verified pendingMerge contains complete challenges with nested matches
  assert.ok(vct.pendingMerge);
  assert.strictEqual(vct.pendingMerge.applied, false);
  assert.strictEqual(vct.pendingMerge.activeChallenges.length, 1);
  assert.strictEqual(vct.pendingMerge.activeChallenges[0].id, "c_local_1");
  assert.strictEqual(vct.pendingMerge.activeChallenges[0].matches.length, 1);
  assert.strictEqual(vct.pendingMerge.activeChallenges[0].matches[0].matchId, "m_loc_1");
  assert.strictEqual(vct.pendingMerge.archives.length, 1);
  assert.strictEqual(vct.pendingMerge.archives[0].id, "c_arc_1");
  assert.strictEqual(vct.pendingMerge.archives[0].matches.length, 1);
});

test("Pathway B: collision with merge cancellation ('Leave them behind') stages nothing", async () => {
  const anonUser = { uid: "anon_bob_456", isAnonymous: true };
  const { vct, ax, calls } = createMockAuthEnvironment(anonUser);
  ax._linkError = { code: "auth/credential-already-in-use" };

  global.window = {
    VCT: vct,
    activeChallenges: [{ id: "c1", matches: [] }],
    archives: [],
    appConfirm: async () => false, // Cancel "Leave them behind"
  };

  const authUi = require("../js/cloud/auth-ui.js");
  await authUi.handleEmailAuth("bob@example.com", "secret123", "signup");

  assert.strictEqual(calls.signInWithEmailAndPassword.length, 1);
  assert.strictEqual(vct.auth.currentUser.uid, "target_account_uid");
  assert.strictEqual(vct.pendingMerge, null); // Absolutely nothing staged
});

// ---------------------------------------------------------------------------
// 3. Pathway C: Existing-Account Sign-In from Anonymous Session
// ---------------------------------------------------------------------------

test("Pathway C: sign-in while anonymous prompts offerMerge", async () => {
  const anonUser = { uid: "anon_charlie_789", isAnonymous: true };
  const { vct, calls } = createMockAuthEnvironment(anonUser);

  let confirmCalled = false;
  global.window = {
    VCT: vct,
    activeChallenges: [{ id: "c_anon", matches: [] }],
    archives: [],
    appConfirm: async () => {
      confirmCalled = true;
      return true;
    },
  };

  const authUi = require("../js/cloud/auth-ui.js");
  await authUi.handleEmailAuth("charlie@example.com", "secret123", "signin");

  assert.strictEqual(confirmCalled, true);
  assert.strictEqual(calls.signInWithEmailAndPassword.length, 1);
  assert.ok(vct.pendingMerge);
  assert.strictEqual(vct.pendingMerge.activeChallenges[0].id, "c_anon");
});

test("Pathway C: sign-in when not anonymous bypasses offerMerge directly", async () => {
  const normalUser = { uid: "existing_user", isAnonymous: false };
  const { vct, calls } = createMockAuthEnvironment(normalUser);

  let confirmCalled = false;
  global.window = {
    VCT: vct,
    activeChallenges: [{ id: "c_other", matches: [] }],
    archives: [],
    appConfirm: async () => { confirmCalled = true; return true; },
  };

  const authUi = require("../js/cloud/auth-ui.js");
  await authUi.handleEmailAuth("charlie@example.com", "secret123", "signin");

  assert.strictEqual(confirmCalled, false);
  assert.strictEqual(calls.signInWithEmailAndPassword.length, 1);
  assert.strictEqual(vct.pendingMerge, null);
});

// ---------------------------------------------------------------------------
// 4. Transactional pendingMerge Staging Cleanup
// ---------------------------------------------------------------------------

test("transactional cleanup: failed signInFn immediately clears staged pendingMerge", async () => {
  const anonUser = { uid: "anon_fail", isAnonymous: true };
  const { vct, ax } = createMockAuthEnvironment(anonUser);
  ax._signInError = { code: "auth/invalid-credential" };

  global.window = {
    VCT: vct,
    activeChallenges: [{ id: "c_staged", matches: [] }],
    archives: [],
    appConfirm: async () => true,
  };

  const authUi = require("../js/cloud/auth-ui.js");
  await assert.rejects(
    async () => {
      await authUi.handleEmailAuth("wrong@example.com", "wrongpass", "signin");
    },
    (err) => err.code === "auth/invalid-credential"
  );

  // Critical assertion: pendingMerge MUST be cleared on auth failure
  assert.strictEqual(vct.pendingMerge, null);
});

// ---------------------------------------------------------------------------
// 5. Cloud-Sync Rehydration Merge & Canonical Array Handling
// ---------------------------------------------------------------------------

test("cloud-sync rehydration: applies pendingMerge with fresh IDs and bucket preservation", () => {
  const cloudSync = require("../js/cloud/cloud-sync.js");
  const { applyDocuments } = require("../js/cloud/snapshot-model.js");

  const originalPending = {
    activeChallenges: [
      {
        id: "c_anon_act",
        name: "Anonymous Active",
        matches: [{ matchId: "m_anon_1", no: 1, agent: "Reyna", kills: 25 }],
      },
    ],
    archives: [
      {
        id: "c_anon_arc",
        name: "Anonymous Archived",
        archivedAt: "2026-01-01T00:00:00.000Z",
        matches: [{ matchId: "m_anon_2", no: 1, agent: "Viper", kills: 18 }],
      },
    ],
    applied: false,
  };

  const targetAccountChallenges = [
    {
      id: "c_target_act",
      doc: { name: "Existing Target Challenge", status: "active", isOpen: true, target: 10, startRank: "Gold 1", startRR: 0 },
    },
  ];

  let persisted = false;
  let toastShown = "";
  const mockWindow = {
    VCT: { pendingMerge: originalPending },
    activeChallenges: [],
    archives: [],
    applyDocuments,
    buildSnapshot: () => ({ challenges: {}, matches: {} }),
    persist: () => {
      persisted = true;
      return true;
    },
    showToast: (msg) => { toastShown = msg; },
    render: () => {},
    newMatchId: () => `m_fresh_${Math.random().toString(36).slice(2, 6)}`,
  };

  global.window = mockWindow;

  cloudSync.rehydrate(targetAccountChallenges, {});

  assert.strictEqual(persisted, true);
  assert.ok(toastShown.includes("2 challenges added"));

  // Check activeChallenges bucket: should contain target challenge + cloned anonymous active
  assert.strictEqual(mockWindow.activeChallenges.length, 2);
  const targetC = mockWindow.activeChallenges.find((c) => c.id === "c_target_act");
  const mergedActive = mockWindow.activeChallenges.find((c) => c.name === "Anonymous Active");
  assert.ok(targetC, "Target challenge must be present");
  assert.ok(mergedActive, "Cloned active challenge must be present");
  assert.notStrictEqual(mergedActive.id, "c_anon_act", "Fresh challenge ID must be assigned");
  assert.strictEqual(mergedActive.matches.length, 1);
  assert.notStrictEqual(mergedActive.matches[0].matchId, "m_anon_1", "Fresh match ID must be assigned");
  assert.strictEqual(mergedActive.matches[0].agent, "Reyna");
  assert.strictEqual(mergedActive.matches[0].kills, 25);

  // Check archives bucket: should strictly contain cloned anonymous archive
  assert.strictEqual(mockWindow.archives.length, 1);
  const mergedArchive = mockWindow.archives[0];
  assert.strictEqual(mergedArchive.name, "Anonymous Archived");
  assert.notStrictEqual(mergedArchive.id, "c_anon_arc", "Fresh challenge ID must be assigned to archive");
  assert.strictEqual(mergedArchive.matches.length, 1);
  assert.notStrictEqual(mergedArchive.matches[0].matchId, "m_anon_2", "Fresh match ID must be assigned to archive match");
  assert.strictEqual(mergedArchive.matches[0].agent, "Viper");
  assert.strictEqual(mergedArchive.matches[0].kills, 18);

  // Exactly-once invariant: pendingMerge must be cleared
  assert.strictEqual(mockWindow.VCT.pendingMerge, null);

  // When subsequent snapshot arrives with only targetAccountChallenges,
  // rehydrate reflects the server entries without re-applying any merge
  cloudSync.rehydrate(targetAccountChallenges, {});
  assert.strictEqual(mockWindow.activeChallenges.length, 1);
  assert.strictEqual(mockWindow.activeChallenges[0].id, "c_target_act");
  assert.strictEqual(mockWindow.archives.length, 0);
});

// ---------------------------------------------------------------------------
// 6. Cloud-Sync Merge Failure & In-Memory Rollback
// ---------------------------------------------------------------------------

test("cloud-sync rollback: failed persist() rolls back in-memory arrays and permits clean retry", () => {
  const cloudSync = require("../js/cloud/cloud-sync.js");
  const { applyDocuments } = require("../js/cloud/snapshot-model.js");

  const pendingPayload = {
    activeChallenges: [{ id: "c_anon", name: "To Merge", matches: [{ matchId: "m1", no: 1 }] }],
    archives: [],
    applied: false,
  };

  const targetDocs = [
    {
      id: "c_target",
      doc: { name: "Existing Target", status: "active", isOpen: true, target: 5, startRank: "Silver 1", startRR: 0 },
    },
  ];

  let persistAttempts = 0;
  let persistReturn = false; // First attempt fails!

  const mockWindow = {
    VCT: { pendingMerge: pendingPayload },
    activeChallenges: [],
    archives: [],
    applyDocuments,
    buildSnapshot: () => ({ challenges: {}, matches: {} }),
    persist: () => {
      persistAttempts++;
      return persistReturn;
    },
    showToast: () => {},
    render: () => {},
  };

  global.window = mockWindow;

  // 1. First rehydration attempt: persistence FAILS
  cloudSync.rehydrate(targetDocs, {});

  assert.strictEqual(persistAttempts, 1);
  // Rollback invariant: in-memory activeChallenges must NOT retain the unpersisted clone
  assert.strictEqual(mockWindow.activeChallenges.length, 1);
  assert.strictEqual(mockWindow.activeChallenges[0].id, "c_target");
  // Staged pendingMerge must be retained and reset for retry
  assert.ok(mockWindow.VCT.pendingMerge);
  assert.strictEqual(mockWindow.VCT.pendingMerge.applied, false);

  // 2. Second rehydration attempt: persistence SUCCEEDS
  persistReturn = true;
  cloudSync.rehydrate(targetDocs, {});

  assert.strictEqual(persistAttempts, 2);
  // Success: exactly one clone was added (target + 1 clone = 2, NOT 3)
  assert.strictEqual(mockWindow.activeChallenges.length, 2);
  assert.strictEqual(mockWindow.activeChallenges[0].id, "c_target");
  assert.strictEqual(mockWindow.activeChallenges[1].name, "To Merge");
  // Pending merge cleared
  assert.strictEqual(mockWindow.VCT.pendingMerge, null);
});

// ---------------------------------------------------------------------------
// 7. Error Message Translations
// ---------------------------------------------------------------------------

test("auth-ui: AUTH_MESSAGES maps error codes and provides safe fallback", () => {
  const authUi = require("../js/cloud/auth-ui.js");

  assert.strictEqual(authUi.authMessage({ code: "auth/invalid-email" }), "That email address does not look right.");
  assert.strictEqual(authUi.authMessage({ code: "auth/missing-password" }), "Enter your password.");
  assert.strictEqual(authUi.authMessage({ code: "auth/weak-password" }), "Choose a password of at least 6 characters.");
  assert.strictEqual(authUi.authMessage({ code: "auth/email-already-in-use" }), "An account already uses that email. Try signing in instead.");
  assert.strictEqual(authUi.authMessage({ code: "auth/invalid-credential" }), "That email and password do not match an account.");
  assert.strictEqual(authUi.authMessage({ code: "auth/too-many-requests" }), "Too many attempts. Wait a minute and try again.");
  assert.strictEqual(authUi.authMessage({ code: "auth/network-request-failed" }), "No connection. Your data is still saved on this device.");
  assert.strictEqual(authUi.authMessage({ code: "unknown-code" }), "Something went wrong signing in. Your local data is untouched.");
  assert.strictEqual(authUi.authMessage(null), "Something went wrong signing in. Your local data is untouched.");
});

// ---------------------------------------------------------------------------
// 8. Regression Invariant: Local Persistence and Sync Intact
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

    global.data = { id: "c_task10", name: "Task 10 Invariant Run", matches: [] };
    global.activeChallenges = [global.data];
    global.archives = [];

    assert.strictEqual(persistLocal(), true);
    assert.ok(store.vct4.includes("Task 10 Invariant Run"));
    assert.strictEqual(persist(), true);
  } finally {
    if (origLocalStorage !== undefined) global.localStorage = origLocalStorage;
    else delete global.localStorage;
    global.data = origData;
    global.activeChallenges = origActive;
    global.archives = origArchives;
  }
});
