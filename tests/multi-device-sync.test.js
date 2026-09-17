const test = require("node:test");
const assert = require("node:assert");

const cloudSync = require("../js/cloud/cloud-sync.js");
const { buildSnapshot, applyDocuments } = require("../js/cloud/snapshot-model.js");
const { diffSnapshots, chunk } = require("../js/cloud/snapshot-diff.js");

// ---------------------------------------------------------------------------
// Test Environment Setup Helpers
// ---------------------------------------------------------------------------

function setupSyncTestEnvironment(initialUser = null) {
  const recorded = {
    setDoc: [],
    getDoc: [],
    getDocs: [],
    onSnapshot: [],
  };

  const mockFx = {
    doc: (db, ...parts) => parts.join("/"),
    collection: (db, ...parts) => parts.join("/"),
    serverTimestamp: () => "MOCK_SERVER_TIMESTAMP",
    setDoc: async (ref, data, opts) => {
      recorded.setDoc.push({ ref, data, opts });
      if (mockFx._setDocError) throw mockFx._setDocError;
    },
    getDoc: async (ref) => {
      recorded.getDoc.push({ ref });
      if (mockFx._getDocError) throw mockFx._getDocError;
      return {
        exists: () => !!mockFx._tombstonesData,
        data: () => mockFx._tombstonesData || {},
      };
    },
    getDocs: async (colRef) => {
      recorded.getDocs.push({ colRef });
      if (mockFx._getDocsHandler) return mockFx._getDocsHandler(colRef);
      return { docs: [] };
    },
    onSnapshot: (ref, callback) => {
      recorded.onSnapshot.push({ ref, callback });
      return () => {}; // unsubscribe no-op
    },
    writeBatch: () => ({
      set: () => {},
      update: () => {},
      delete: () => {},
      commit: async () => {},
    }),
    _setDocError: null,
    _getDocError: null,
    _tombstonesData: null,
    _getDocsHandler: null,
  };

  const auth = {
    currentUser: initialUser,
  };

  const vct = {
    fx: mockFx,
    db: { type: "mockDb" },
    auth,
    cloud: cloudSync,
    pendingMerge: null,
  };

  global.window = {
    VCT: vct,
    buildSnapshot,
    diffSnapshots,
    applyDocuments,
    chunk,
    activeChallenges: [],
    archives: [],
    data: null,
    persistLocal: () => true,
    persist: () => true,
    render: () => {},
    showToast: () => {},
  };

  return { vct, mockFx, auth, recorded };
}

// ---------------------------------------------------------------------------
// 1. Profile Document Schema & Merge Semantics
// ---------------------------------------------------------------------------

test("Profile Document: start(uid) writes schemaVersion, profile fields, serverTimestamp with merge: true", async () => {
  const user = {
    uid: "uid_jett",
    displayName: "JettPlayer",
    email: "jett@val.com",
    photoURL: "https://val.com/jett.png",
    isAnonymous: false,
  };
  const { recorded } = setupSyncTestEnvironment(user);

  await cloudSync.start("uid_jett");

  assert.strictEqual(recorded.setDoc.length >= 1, true, "setDoc should be called at least once");
  const profileWrite = recorded.setDoc.find((w) => w.ref === "users/uid_jett");
  assert.ok(profileWrite, "Root profile document must be written to users/uid_jett");

  // Options verification: { merge: true }
  assert.deepStrictEqual(profileWrite.opts, { merge: true }, "Must use merge: true to avoid wiping subcollections or existing fields");

  // Payload verification
  const payload = profileWrite.data;
  assert.strictEqual(payload.schemaVersion, 1, "schemaVersion must be 1");
  assert.strictEqual(payload.displayName, "JettPlayer", "displayName must match currentUser");
  assert.strictEqual(payload.email, "jett@val.com", "email must match currentUser");
  assert.strictEqual(payload.photoURL, "https://val.com/jett.png", "photoURL must match currentUser");
  assert.strictEqual(payload.updatedAt, "MOCK_SERVER_TIMESTAMP", "updatedAt must use serverTimestamp");

  // Riot write-protection invariant: client must NEVER write riot field
  assert.strictEqual("riot" in payload, false, "Client write must strictly exclude riot field");
});

// ---------------------------------------------------------------------------
// 2. Anonymous Fallback Profile Writing
// ---------------------------------------------------------------------------

test("Profile Document: anonymous user safely writes null for missing profile fields", async () => {
  const anonUser = {
    uid: "uid_anon",
    displayName: null,
    email: null,
    photoURL: null,
    isAnonymous: true,
  };
  const { recorded } = setupSyncTestEnvironment(anonUser);

  await cloudSync.start("uid_anon");

  const profileWrite = recorded.setDoc.find((w) => w.ref === "users/uid_anon");
  assert.ok(profileWrite, "Root profile document must be written for anonymous user");

  const payload = profileWrite.data;
  assert.strictEqual(payload.schemaVersion, 1);
  assert.strictEqual(payload.displayName, null, "Missing displayName must be coerced to null");
  assert.strictEqual(payload.email, null, "Missing email must be coerced to null");
  assert.strictEqual(payload.photoURL, null, "Missing photoURL must be coerced to null");
  assert.strictEqual(payload.updatedAt, "MOCK_SERVER_TIMESTAMP");
  assert.strictEqual("riot" in payload, false, "riot field must remain absent");
});

// ---------------------------------------------------------------------------
// 3. Null Auth / Missing User Tolerance
// ---------------------------------------------------------------------------

test("Profile Document: null auth or currentUser safely coerces profile fields to null", async () => {
  const { recorded, vct } = setupSyncTestEnvironment(null);
  vct.auth = null; // simulate completely uninitialized auth object

  await cloudSync.start("uid_no_auth");

  const profileWrite = recorded.setDoc.find((w) => w.ref === "users/uid_no_auth");
  assert.ok(profileWrite, "Profile document write attempted");

  const payload = profileWrite.data;
  assert.strictEqual(payload.displayName, null);
  assert.strictEqual(payload.email, null);
  assert.strictEqual(payload.photoURL, null);
  assert.strictEqual(payload.schemaVersion, 1);
});

// ---------------------------------------------------------------------------
// 4. Profile Write Failure Tolerance (Resilience)
// ---------------------------------------------------------------------------

test("Profile Document: transient setDoc error in start() does not abort sync initialization", async () => {
  const user = { uid: "uid_resilient", isAnonymous: true };
  const { mockFx, recorded } = setupSyncTestEnvironment(user);

  mockFx._setDocError = new Error("Firestore unavailable (simulated network error)");

  // start() should not throw
  await assert.doesNotReject(async () => {
    await cloudSync.start("uid_resilient");
  }, "start() must catch profile setDoc errors gracefully");

  // Subsequent sync initialization must still proceed:
  // initial tombstones getDoc and onSnapshot subscriptions must have been called
  assert.strictEqual(recorded.getDoc.length >= 1, true, "tombstones getDoc must still execute");
  assert.strictEqual(
    recorded.onSnapshot.some((s) => s.ref.includes("users/uid_resilient/meta/tombstones")),
    true,
    "tombstones onSnapshot listener must still be attached"
  );
  assert.strictEqual(
    recorded.onSnapshot.some((s) => s.ref.includes("users/uid_resilient/challenges")),
    true,
    "challenges onSnapshot listener must still be attached"
  );
});

// ---------------------------------------------------------------------------
// 5. Client Snapshot Callback Orchestration
// ---------------------------------------------------------------------------

test("Multi-Device Snapshot Orchestration: incoming snapshot rehydrates client state", async () => {
  const { mockFx } = setupSyncTestEnvironment({ uid: "uid_multi" });

  let challengesCallback = null;

  mockFx.onSnapshot = (ref, cb) => {
    if (typeof ref === "string" && ref.endsWith("challenges")) {
      challengesCallback = cb;
    }
    return () => {};
  };

  const incomingMatchDoc = {
    id: "m_remote_1",
    data: () => ({
      no: 1,
      date: "2026-09-17T10:15:00Z",
      agent: "Reyna",
      map: "Bind",
      result: "Win",
      myScore: 13,
      enemyScore: 9,
      rounds: 22,
      rankAfter: "Silver 1",
      rankStatus: "Same Rank",
      rrAfter: 70,
      rrChange: 20,
      kills: 24,
      deaths: 12,
      assists: 5,
      hs: 30,
      acs: 290,
      adr: 180,
      kast: 75,
      source: "manual",
      riotMatchId: null,
    }),
  };

  mockFx._getDocsHandler = (colRef) => {
    if (typeof colRef === "string" && colRef.includes("c_remote/matches")) {
      return { docs: [incomingMatchDoc] };
    }
    return { docs: [] };
  };

  await cloudSync.start("uid_multi");

  assert.ok(challengesCallback, "Challenges snapshot listener attached");

  // Simulate remote update from Device A arriving on Device B
  const incomingChallengeDoc = {
    id: "c_remote",
    data: () => ({
      name: "Remote Challenge",
      target: 20,
      startRank: "Silver 1",
      startRR: 50,
      status: "active",
      isOpen: true,
      updatedAt: "2026-09-17T10:00:00Z",
    }),
  };

  // Trigger challenges listener
  await challengesCallback({
    docs: [incomingChallengeDoc],
  });

  // Verify rehydration into global state
  assert.strictEqual(global.window.activeChallenges.length, 1);
  assert.strictEqual(global.window.activeChallenges[0].id, "c_remote");
  assert.strictEqual(global.window.activeChallenges[0].name, "Remote Challenge");
  assert.strictEqual(global.window.activeChallenges[0].matches.length, 1);
  assert.strictEqual(global.window.activeChallenges[0].matches[0].matchId, "m_remote_1");
  assert.strictEqual(global.window.activeChallenges[0].matches[0].agent, "Reyna");
});

// ---------------------------------------------------------------------------
// 6. Document-Level Isolation (Diff & Reference Disjointness)
// ---------------------------------------------------------------------------

test("Document-Level Isolation: concurrent edits to different matches produce disjoint write paths", () => {
  // Base state: Challenge c1 with two matches: m1 and m2
  const baseChallenge = {
    id: "c1",
    name: "Isolation Test Challenge",
    target: 10,
    startRank: "Gold 1",
    startRR: 50,
    status: "active",
    isOpen: true,
    matches: [
      { matchId: "m1", no: 1, agent: "Jett", map: "Ascent", result: "Win", notes: "Original notes", acs: 200, rounds: 20, myScore: 13, enemyScore: 7 },
      { matchId: "m2", no: 2, agent: "Omen", map: "Haven", result: "Loss", notes: "", acs: 180, rounds: 21, myScore: 8, enemyScore: 13 },
    ],
  };

  const baseSnapshot = buildSnapshot({
    activeChallenges: [baseChallenge],
    archives: [],
    data: baseChallenge,
  });

  // Device A modifies notes on match m1
  const devAChallenge = JSON.parse(JSON.stringify(baseChallenge));
  devAChallenge.matches[0].notes = "Device A updated notes";
  const devASnapshot = buildSnapshot({
    activeChallenges: [devAChallenge],
    archives: [],
    data: devAChallenge,
  });
  const devADiff = diffSnapshots(baseSnapshot, devASnapshot);

  // Device B modifies ACS on match m2
  const devBChallenge = JSON.parse(JSON.stringify(baseChallenge));
  devBChallenge.matches[1].acs = 250;
  const devBSnapshot = buildSnapshot({
    activeChallenges: [devBChallenge],
    archives: [],
    data: devBChallenge,
  });
  const devBDiff = diffSnapshots(baseSnapshot, devBSnapshot);

  // Device A only updates c1/m1
  assert.strictEqual(devADiff.updates.length, 1);
  assert.strictEqual(devADiff.updates[0].key, "c1/m1");
  assert.strictEqual(devADiff.updates[0].doc.notes, "Device A updated notes");

  // Device B only updates c1/m2
  assert.strictEqual(devBDiff.updates.length, 1);
  assert.strictEqual(devBDiff.updates[0].key, "c1/m2");
  assert.strictEqual(devBDiff.updates[0].doc.acs, 250);

  // Key paths are strictly disjoint
  const keysA = new Set(devADiff.updates.map((u) => u.key));
  const keysB = new Set(devBDiff.updates.map((u) => u.key));
  const intersection = [...keysA].filter((k) => keysB.has(k));

  assert.strictEqual(intersection.length, 0, "Independent match document paths must be disjoint");
});

// ---------------------------------------------------------------------------
// 7. Client-Side Tombstone Filtering (Stale Write Prevention)
// ---------------------------------------------------------------------------

test("Client Tombstone Filtering: stale changes to deleted entities are filtered before dispatch", () => {
  const tombstones = {
    "m_c1_m1": "2026-09-17T00:00:00Z",
    "c_c_deleted": "2026-09-17T00:00:00Z",
  };

  const changes = [
    { kind: "match", action: "update", key: "c1/m1", doc: { acs: 300 } }, // tombstoned match
    { kind: "match", action: "update", key: "c1/m2", doc: { acs: 220 } }, // active match
    { kind: "challenge", action: "update", key: "c_deleted", doc: { name: "Stale" } }, // tombstoned challenge
    { kind: "challenge", action: "update", key: "c_active", doc: { name: "Fresh" } }, // active challenge
  ];

  const count = cloudSync.countProjectedOperations(changes, new Set(), tombstones);

  // m1 is skipped because m_c1_m1 is tombstoned
  // c_deleted is skipped because c_c_deleted is tombstoned
  // m2 survives (1 match update + 1 parent challenge touch) = 2
  // c_active survives (1 challenge update) = 1
  // Total projected operations = 3
  assert.strictEqual(count, 3, "Tombstoned entities must not contribute to projected operations or batches");
});

// ---------------------------------------------------------------------------
// 8. Server-Authoritative Conflict Convergence Principle
// ---------------------------------------------------------------------------

test("Server-Authoritative Conflict: client snapshot directly adopts server document state", () => {
  // Device has local state for match m1
  const localMatch = {
    matchId: "m1",
    no: 1,
    agent: "Jett",
    map: "Ascent",
    result: "Win",
    myScore: 13,
    enemyScore: 11,
    rounds: 24,
    notes: "Local unsynced edit",
  };

  // Server committed state arrived via snapshot
  const serverChallengeEntries = [
    {
      id: "c1",
      doc: {
        name: "Authoritative Challenge",
        target: 20,
        startRank: "Gold 1",
        startRR: 50,
        status: "active",
        isOpen: true,
      },
    },
  ];

  const serverMatchEntriesByChallenge = {
    c1: [
      {
        id: "m1",
        doc: {
          no: 1,
          agent: "Jett",
          map: "Ascent",
          result: "Win",
          myScore: 13,
          enemyScore: 11,
          rounds: 24,
          notes: "Server authoritative winner",
          updatedAt: "2026-09-17T12:00:00Z",
        },
      },
    ],
  };

  const rehydrated = applyDocuments(serverChallengeEntries, serverMatchEntriesByChallenge);

  // Client converges to server state without client-side arbitration
  assert.strictEqual(rehydrated.activeChallenges.length, 1);
  const rehydratedMatch = rehydrated.activeChallenges[0].matches[0];
  assert.strictEqual(rehydratedMatch.notes, "Server authoritative winner");
  assert.notStrictEqual(rehydratedMatch.notes, localMatch.notes);
});
