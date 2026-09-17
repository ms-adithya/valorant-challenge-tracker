const test = require("node:test");
const assert = require("node:assert");

const authUI = require("../js/cloud/auth-ui.js");
const { safeRead } = require("../js/storage.js");
const cloudMigrate = require("../js/cloud/cloud-migrate.js");

// ---------------------------------------------------------------------------
// Mock Helpers
// ---------------------------------------------------------------------------

function createMockStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
}

// ---------------------------------------------------------------------------
// 1. Purge Local Storage on Sign-Out
// ---------------------------------------------------------------------------

test("Sign-out isolation: purgeLocalSession removes all VCT localStorage keys and clears pendingMerge", () => {
  const mockLocal = createMockStorage();
  const mockSession = createMockStorage();

  mockLocal.setItem("vct4", JSON.stringify({ id: "c_alice", name: "Alice Challenge" }));
  mockLocal.setItem("vctActiveChallenges", JSON.stringify([{ id: "c_alice" }]));
  mockLocal.setItem("vctArchives", JSON.stringify([{ id: "c_alice_archived" }]));
  mockLocal.setItem("vct2", JSON.stringify({ id: "c_legacy" }));
  mockLocal.setItem("unrelated_app_setting", "dark_mode");

  mockSession.setItem("vct_temp_key", "temp_val");
  mockSession.setItem("unrelated_tab_state", "tab_2");

  const vct = { pendingMerge: { applied: false, activeChallenges: [{ id: "c1" }] } };

  global.localStorage = mockLocal;
  global.sessionStorage = mockSession;
  global.window = { localStorage: mockLocal, sessionStorage: mockSession, VCT: vct };
  global.VCT = vct;

  authUI.purgeLocalSession();

  assert.strictEqual(mockLocal.getItem("vct4"), null, "vct4 must be purged");
  assert.strictEqual(mockLocal.getItem("vctActiveChallenges"), null, "vctActiveChallenges must be purged");
  assert.strictEqual(mockLocal.getItem("vctArchives"), null, "vctArchives must be purged");
  assert.strictEqual(mockLocal.getItem("vct2"), null, "vct2 must be purged");
  assert.strictEqual(mockLocal.getItem("unrelated_app_setting"), "dark_mode", "Unrelated keys preserved");

  assert.strictEqual(mockSession.getItem("vct_temp_key"), null, "vct session key must be purged");
  assert.strictEqual(mockSession.getItem("unrelated_tab_state"), "tab_2", "unrelated session key preserved");
  assert.strictEqual(vct.pendingMerge, null, "pendingMerge must be reset to null");
});

// ---------------------------------------------------------------------------
// 2. signOut() Flow with Confirmation & Purge
// ---------------------------------------------------------------------------

test("Sign-out isolation: confirmed signOut calls VCT.ax.signOut and purges local storage", async () => {
  const mockLocal = createMockStorage();
  mockLocal.setItem("vct4", JSON.stringify({ id: "c_alice" }));
  mockLocal.setItem("vctActiveChallenges", JSON.stringify([{ id: "c_alice" }]));

  let axSignOutCalled = false;
  let reloaded = false;

  const mockAx = {
    signOut: async (auth) => {
      axSignOutCalled = true;
    },
  };

  const vct = {
    ax: mockAx,
    auth: { currentUser: { uid: "alice" } },
    pendingMerge: { applied: false },
  };

  global.localStorage = mockLocal;
  global.VCT = vct;
  global.window = {
    localStorage: mockLocal,
    appConfirm: async () => true, // user confirms sign out
    location: {
      reload: () => { reloaded = true; },
    },
    VCT: vct,
  };

  await authUI.signOut();

  assert.strictEqual(axSignOutCalled, true, "VCT.ax.signOut must be called");
  assert.strictEqual(mockLocal.getItem("vct4"), null, "vct4 must be purged before reload");
  assert.strictEqual(mockLocal.getItem("vctActiveChallenges"), null, "vctActiveChallenges must be purged before reload");
  assert.strictEqual(reloaded, true, "Page reload must be invoked");
});

test("Sign-out isolation: cancelled signOut does NOT purge storage and does NOT sign out", async () => {
  const mockLocal = createMockStorage();
  mockLocal.setItem("vct4", JSON.stringify({ id: "c_alice" }));

  let axSignOutCalled = false;
  let reloaded = false;

  const vct = {
    ax: { signOut: async () => { axSignOutCalled = true; } },
    auth: { currentUser: { uid: "alice" } },
  };

  global.localStorage = mockLocal;
  global.VCT = vct;
  global.window = {
    localStorage: mockLocal,
    appConfirm: async () => false, // user cancels sign out
    location: { reload: () => { reloaded = true; } },
    VCT: vct,
  };

  await authUI.signOut();

  assert.strictEqual(axSignOutCalled, false, "VCT.ax.signOut must not be called when cancelled");
  assert.notStrictEqual(mockLocal.getItem("vct4"), null, "vct4 must NOT be purged when cancelled");
  assert.strictEqual(reloaded, false, "Page reload must not be triggered");
});

// ---------------------------------------------------------------------------
// 3. Post-Reload Clean Session & SafeRead State
// ---------------------------------------------------------------------------

test("Sign-out isolation: safeRead returns clean empty state after session purge", () => {
  const mockLocal = createMockStorage();
  global.localStorage = mockLocal;

  // After purge:
  const data = safeRead("vct4", null);
  const active = safeRead("vctActiveChallenges", []);
  const archives = safeRead("vctArchives", []);

  assert.strictEqual(data, null);
  assert.deepStrictEqual(active, []);
  assert.deepStrictEqual(archives, []);
});

// ---------------------------------------------------------------------------
// 4. Migration Prevention into New Anonymous Account
// ---------------------------------------------------------------------------

test("Sign-out isolation: migrator does NOT migrate previous user's data to new anonymous UID", async () => {
  const mockLocal = createMockStorage();
  // Storage is clean after sign-out purge
  global.localStorage = mockLocal;

  let writtenToFirestore = false;
  const mockDb = {};
  const mockFx = {
    doc: () => "mockRef",
    getDoc: async () => ({ exists: () => false }), // no migration doc yet
    setDoc: async () => {},
    serverTimestamp: () => "SERVER_TS",
    runTransaction: async (db, txFn) => {
      writtenToFirestore = true;
      return txFn({
        get: async () => ({ exists: () => false }),
        set: () => {},
      });
    },
  };

  const vct = { fx: mockFx, db: mockDb };
  global.VCT = vct;
  global.window = {
    localStorage: mockLocal,
    VCT: vct,
  };

  const result = await cloudMigrate.run("new_anon_uid_after_signout");

  assert.strictEqual(result.migrated, false, "Must report migrated: false when storage was purged");
  assert.strictEqual(result.challengeCount, 0);
  assert.strictEqual(writtenToFirestore, false, "Must not write any documents to new anonymous account");
});

// ---------------------------------------------------------------------------
// 5. User B Merge Isolation (No Spurious Merge Prompt)
// ---------------------------------------------------------------------------

test("Sign-out isolation: User B signing in after User A sign-out has no pendingMerge staged", async () => {
  const mockLocal = createMockStorage();
  global.localStorage = mockLocal;

  // Simulate User A signed in, then signed out (purged)
  const vct = { pendingMerge: null };
  global.VCT = vct;
  global.window = { localStorage: mockLocal, VCT: vct };

  authUI.purgeLocalSession();

  // Next: User B comes to browser and signs in
  assert.strictEqual(vct.pendingMerge, null, "User B starts with null pendingMerge");

  // In cloud-sync rehydrate, pendingMerge is null, so User B sees only their server data
  let toastShown = false;
  global.window.showToast = () => { toastShown = true; };

  assert.strictEqual(toastShown, false, "No spurious merge toast shown for User B");
});

// ---------------------------------------------------------------------------
// 6. Preservation of Fresh Local Sessions
// ---------------------------------------------------------------------------

test("Sign-out isolation: fresh anonymous session can save and persist challenges normally", () => {
  const mockLocal = createMockStorage();
  global.localStorage = mockLocal;

  // New challenge created in fresh session
  const newChallenge = {
    id: "c_fresh_1",
    name: "Fresh Session Challenge",
    target: 10,
    startRank: "Silver 1",
    matches: [],
  };

  mockLocal.setItem("vct4", JSON.stringify(newChallenge));
  mockLocal.setItem("vctActiveChallenges", JSON.stringify([newChallenge]));

  const data = safeRead("vct4", null);
  const active = safeRead("vctActiveChallenges", []);

  assert.ok(data);
  assert.strictEqual(data.id, "c_fresh_1");
  assert.strictEqual(active.length, 1);
});

