const test = require("node:test");
const assert = require("node:assert");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const fs = require("node:fs");

let env;

const validChallenge = {
  name: "Road to Gold",
  target: 20,
  startRank: "Silver 2",
  startRR: 40,
  targetRank: "Gold 1",
  description: "",
  status: "active",
  isOpen: true,
  archivedAt: null,
};

const validMatch = {
  no: 1,
  date: "2026-09-06T10:00:00.000Z",
  agent: "Jett",
  map: "Ascent",
  result: "Win",
  rankAfter: "Silver 2",
  rankStatus: "Same Rank",
  rrAfter: 60,
  rrChange: 20,
  myScore: 13,
  enemyScore: 7,
  rounds: 20,
  kills: 20,
  deaths: 14,
  assists: 4,
  ddDelta: null,
  hs: 24,
  acs: 240,
  adr: 150,
  kast: 72,
  firstKills: null,
  firstDeaths: null,
  multiKills: null,
  notes: "",
  source: "manual",
  riotMatchId: null,
};

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: "vct-rules-test",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

test.beforeEach(async () => { await env.clearFirestore(); });
test.after(async () => { await env.cleanup(); });

const asAlice = () => env.authenticatedContext("alice").firestore();
const asBob = () => env.authenticatedContext("bob").firestore();
const asAnon = () => env.unauthenticatedContext().firestore();

test("owner can create and read their own challenge", async () => {
  const db = asAlice();
  await assertSucceeds(db.doc("users/alice/challenges/c1").set(validChallenge));
  await assertSucceeds(db.doc("users/alice/challenges/c1").get());
});

test("another signed-in user cannot read or write it", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc("users/alice/challenges/c1").set(validChallenge);
  });
  const db = asBob();
  await assertFails(db.doc("users/alice/challenges/c1").get());
  await assertFails(db.doc("users/alice/challenges/c1").set(validChallenge));
});

test("signed-out users are denied entirely", async () => {
  const db = asAnon();
  await assertFails(db.doc("users/alice/challenges/c1").get());
  await assertFails(db.doc("users/alice/challenges/c1").set(validChallenge));
});

test("valid match is accepted", async () => {
  const db = asAlice();
  await assertSucceeds(db.doc("users/alice/challenges/c1").set(validChallenge));
  await assertSucceeds(
    db.doc("users/alice/challenges/c1/matches/m1").set(validMatch)
  );
});

test("rounds must equal the sum of scores", async () => {
  const db = asAlice();
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m1")
      .set({ ...validMatch, rounds: 19 })
  );
});

test("out-of-range percentages are rejected", async () => {
  const db = asAlice();
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m1").set({ ...validMatch, hs: 101 })
  );
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m1").set({ ...validMatch, kast: -1 })
  );
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m1").set({ ...validMatch, rrAfter: 120 })
  );
});

test("negative counters are rejected", async () => {
  const db = asAlice();
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m1").set({ ...validMatch, kills: -1 })
  );
});

test("null optional values are accepted", async () => {
  const db = asAlice();
  await assertSucceeds(
    db.doc("users/alice/challenges/c1/matches/m1")
      .set({ ...validMatch, rrAfter: null, rrChange: null, hs: null })
  );
});

test("unknown enum values are rejected", async () => {
  const db = asAlice();
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m1")
      .set({ ...validMatch, result: "Forfeit" })
  );
  await assertFails(
    db.doc("users/alice/challenges/c1").set({ ...validChallenge, status: "deleted" })
  );
});

test("client cannot write the riot field on its own user document", async () => {
  const db = asAlice();
  await assertFails(
    db.doc("users/alice").set({ displayName: "Alice", riot: { puuid: "p1" } })
  );
});

test("client cannot write riotAccounts at all", async () => {
  const db = asAlice();
  await assertFails(db.doc("riotAccounts/p1").set({ uid: "alice" }));
  await assertFails(db.doc("riotAccounts/p1").get());
});

test("owner can read and write meta documents such as tombstones and migration", async () => {
  const db = asAlice();
  await assertSucceeds(
    db.doc("users/alice/meta/tombstones").set({ c_c1: new Date().toISOString() })
  );
  await assertSucceeds(db.doc("users/alice/meta/tombstones").get());
  await assertSucceeds(
    db.doc("users/alice/meta/migration").set({ challengeCount: 1, matchCount: 2 })
  );
  await assertSucceeds(db.doc("users/alice/meta/migration").get());

  const bob = asBob();
  await assertFails(bob.doc("users/alice/meta/tombstones").get());
  await assertFails(
    bob.doc("users/alice/meta/tombstones").set({ c_c1: new Date().toISOString() })
  );
});

test("owner can update updatedAt on existing valid challenge, but cannot create empty challenge", async () => {
  const db = asAlice();
  // Create valid challenge first
  await assertSucceeds(db.doc("users/alice/challenges/c1").set(validChallenge));
  // Updating updatedAt on existing document succeeds
  await assertSucceeds(
    db.doc("users/alice/challenges/c1").update({ updatedAt: new Date().toISOString() })
  );
  // Creating a new document with only updatedAt fails validation
  await assertFails(
    db.doc("users/alice/challenges/c2").set({ updatedAt: new Date().toISOString() })
  );
});

test("boundary values: exact boundaries 0 and 100 are accepted, beyond is rejected", async () => {
  const db = asAlice();
  await assertSucceeds(db.doc("users/alice/challenges/c1").set(validChallenge));

  // 0 and 100 percentage values are allowed
  await assertSucceeds(
    db.doc("users/alice/challenges/c1/matches/m_b0").set({
      ...validMatch,
      hs: 0,
      kast: 0,
      rrAfter: 0,
    })
  );
  await assertSucceeds(
    db.doc("users/alice/challenges/c1/matches/m_b100").set({
      ...validMatch,
      no: 2,
      hs: 100,
      kast: 100,
      rrAfter: 100,
    })
  );

  // Negative boundaries or > 100 rejected
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m_b_neg").set({ ...validMatch, hs: -1 })
  );
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m_b_over").set({ ...validMatch, kast: 101 })
  );

  // Challenge startRR boundary tests
  await assertSucceeds(
    db.doc("users/alice/challenges/c_rr0").set({ ...validChallenge, startRR: 0 })
  );
  await assertSucceeds(
    db.doc("users/alice/challenges/c_rr100").set({ ...validChallenge, startRR: 100 })
  );
  await assertFails(
    db.doc("users/alice/challenges/c_rr_neg").set({ ...validChallenge, startRR: -1 })
  );
  await assertFails(
    db.doc("users/alice/challenges/c_rr_over").set({ ...validChallenge, startRR: 101 })
  );

  // Target matches boundary tests: target >= 1
  await assertSucceeds(
    db.doc("users/alice/challenges/c_t1").set({ ...validChallenge, target: 1 })
  );
  await assertFails(
    db.doc("users/alice/challenges/c_t0").set({ ...validChallenge, target: 0 })
  );

  // Match number boundary: no >= 1
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m_no0").set({ ...validMatch, no: 0 })
  );
});

test("challenge name boundary: empty string rejected, <= 200 accepted, > 200 rejected", async () => {
  const db = asAlice();
  await assertFails(
    db.doc("users/alice/challenges/c_empty").set({ ...validChallenge, name: "" })
  );
  const name200 = "a".repeat(200);
  await assertSucceeds(
    db.doc("users/alice/challenges/c_200").set({ ...validChallenge, name: name200 })
  );
  const name201 = "a".repeat(201);
  await assertFails(
    db.doc("users/alice/challenges/c_201").set({ ...validChallenge, name: name201 })
  );
});

test("malformed rounds: rounds arithmetic and negative scores are rejected", async () => {
  const db = asAlice();
  await assertSucceeds(db.doc("users/alice/challenges/c1").set(validChallenge));

  // Rounds mismatch
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m_bad_sum").set({
      ...validMatch,
      myScore: 13,
      enemyScore: 7,
      rounds: 21,
    })
  );

  // Negative scores
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m_neg_score").set({
      ...validMatch,
      myScore: -1,
      enemyScore: 13,
      rounds: 12,
    })
  );

  // Non-integer rounds
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m_float_rounds").set({
      ...validMatch,
      myScore: 13,
      enemyScore: 7,
      rounds: 20.5,
    })
  );
});

test("unauthorized collections: arbitrary root collections are blocked", async () => {
  const alice = asAlice();
  const anon = asAnon();

  await assertFails(alice.doc("admin/config").get());
  await assertFails(alice.doc("admin/config").set({ key: "val" }));
  await assertFails(alice.doc("system/metrics").get());
  await assertFails(alice.doc("system/metrics").set({ cpu: 99 }));
  await assertFails(anon.doc("admin/config").get());

  // Alice cannot access Bob's challenges or matches
  await assertFails(alice.doc("users/bob/challenges/c1").get());
  await assertFails(alice.doc("users/bob/challenges/c1").set(validChallenge));
  await assertFails(alice.doc("users/bob/challenges/c1/matches/m1").get());
  await assertFails(alice.doc("users/bob/challenges/c1/matches/m1").set(validMatch));
});

test("tamper attempts: unauthorized source, negative stats, and riot key injection are blocked", async () => {
  const db = asAlice();
  await assertSucceeds(db.doc("users/alice/challenges/c1").set(validChallenge));

  // Tamper match source (only 'manual', 'import', 'riot' permitted)
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m_bad_src").set({
      ...validMatch,
      source: "cheat_engine",
    })
  );

  // Negative stat counters
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m_neg_deaths").set({
      ...validMatch,
      deaths: -1,
    })
  );
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m_neg_acs").set({
      ...validMatch,
      acs: -10,
    })
  );

  // Tamper user profile with riot key during update
  await assertSucceeds(db.doc("users/alice").set({ displayName: "Alice" }));
  await assertFails(db.doc("users/alice").update({ riot: { puuid: "stolen-puuid" } }));
});

test("boundary validation: float score values and float challenge targets are rejected", async () => {
  const db = asAlice();
  await assertSucceeds(db.doc("users/alice/challenges/c1").set(validChallenge));

  // Float target match count rejected
  await assertFails(
    db.doc("users/alice/challenges/c_float_target").set({ ...validChallenge, target: 10.5 })
  );

  // Float myScore rejected
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m_float_myscore").set({
      ...validMatch,
      myScore: 12.5,
      enemyScore: 7.5,
      rounds: 20,
    })
  );

  // Float enemyScore rejected
  await assertFails(
    db.doc("users/alice/challenges/c1/matches/m_float_enemyscore").set({
      ...validMatch,
      myScore: 13,
      enemyScore: 7.5,
      rounds: 20,
    })
  );
});

test("unauthorized operations: foreign user cannot delete challenge, matches, or meta docs", async () => {
  const alice = asAlice();
  const bob = asBob();
  await assertSucceeds(alice.doc("users/alice/challenges/c1").set(validChallenge));
  await assertSucceeds(alice.doc("users/alice/challenges/c1/matches/m1").set(validMatch));
  await assertSucceeds(alice.doc("users/alice/meta/tombstones").set({ c1: "2026-09-15T00:00:00Z" }));

  // Bob cannot delete Alice's challenge
  await assertFails(bob.doc("users/alice/challenges/c1").delete());
  // Bob cannot delete Alice's match
  await assertFails(bob.doc("users/alice/challenges/c1/matches/m1").delete());
  // Bob cannot delete Alice's meta documents
  await assertFails(bob.doc("users/alice/meta/tombstones").delete());
});

test("atomic delete transaction: complete successful delete leaves doc absent and tombstone present", async () => {
  const alice = asAlice();
  const cRef = alice.doc("users/alice/challenges/c_del");
  const mRef = alice.doc("users/alice/challenges/c_del/matches/m_del");
  const tsRef = alice.doc("users/alice/meta/tombstones");

  // Setup challenge and match
  await assertSucceeds(cRef.set(validChallenge));
  await assertSucceeds(mRef.set(validMatch));

  // Atomic batch delete mimicking cloud-sync.js
  const batch = alice.batch();
  batch.delete(cRef);
  batch.delete(mRef);
  batch.set(tsRef, { c_c_del: "2026-09-15T00:00:00Z", m_c_del_m_del: "2026-09-15T00:00:00Z" }, { merge: true });
  await assertSucceeds(batch.commit());

  // Verify both: target docs are absent AND tombstones exist
  const cSnap = await cRef.get();
  const mSnap = await mRef.get();
  const tsSnap = await tsRef.get();
  assert.strictEqual(cSnap.exists, false, "Challenge doc must be absent after delete");
  assert.strictEqual(mSnap.exists, false, "Match doc must be absent after delete");
  assert.ok(tsSnap.exists, "Tombstone doc must exist");
  assert.ok(tsSnap.data()?.c_c_del, "Challenge tombstone must be recorded");
  assert.ok(tsSnap.data()?.m_c_del_m_del, "Match tombstone must be recorded");
});

test("batch atomicity & failure-path: failing batch cannot leave doc deleted while tombstone is absent", async () => {
  const alice = asAlice();
  const cRef = alice.doc("users/alice/challenges/c_atomic");
  const tsRef = alice.doc("users/alice/meta/tombstones");

  await assertSucceeds(cRef.set(validChallenge));

  // Construct batch with delete + tombstone + an invalid write that fails security rules
  const batch = alice.batch();
  batch.delete(cRef);
  batch.set(tsRef, { c_c_atomic: "2026-09-15T00:00:00Z" }, { merge: true });
  batch.set(alice.doc("users/alice/challenges/c_illegal"), { ...validChallenge, target: -10 }); // Fails rules!

  await assertFails(batch.commit());

  // Verify atomicity: document remains intact and tombstone is absent
  const cSnap = await cRef.get();
  const tsSnap = await tsRef.get();
  assert.strictEqual(cSnap.exists, true, "Challenge doc must remain intact after aborted batch");
  assert.strictEqual(tsSnap.data()?.c_c_atomic, undefined, "Tombstone must not be committed on failed batch");
});

test("write barrier Scenario 1: delete committed first permanently rejects subsequent stale writes", async () => {
  const alice = asAlice();
  const cRef = alice.doc("users/alice/challenges/c_scen1");
  const mRef = alice.doc("users/alice/challenges/c_scen1/matches/m1");
  const tsRef = alice.doc("users/alice/meta/tombstones");

  await assertSucceeds(cRef.set(validChallenge));
  await assertSucceeds(mRef.set(validMatch));

  // Atomic delete and tombstone commit
  const batch = alice.batch();
  batch.delete(cRef);
  batch.delete(mRef);
  batch.set(tsRef, { c_c_scen1: "2026-09-15T00:00:00Z", m_c_scen1_m1: "2026-09-15T00:00:00Z" }, { merge: true });
  await assertSucceeds(batch.commit());

  // Subsequent stale create or update for challenge is rejected
  await assertFails(cRef.set(validChallenge));
  await assertFails(cRef.update({ name: "Stale resurrection" }));

  // Subsequent stale create or update for match is rejected
  await assertFails(mRef.set(validMatch));
  await assertFails(mRef.update({ agent: "Omen" }));
});

test("write barrier Scenario 2: stale write commits first, then delete+tombstone commits and locks writes", async () => {
  const alice = asAlice();
  const cRef = alice.doc("users/alice/challenges/c_scen2");
  const tsRef = alice.doc("users/alice/meta/tombstones");

  await assertSucceeds(cRef.set(validChallenge));

  // 1. Stale write commits first
  await assertSucceeds(cRef.update({ name: "Stale Offline Change" }));
  const preSnap = await cRef.get();
  assert.strictEqual(preSnap.data().name, "Stale Offline Change");

  // 2. Later delete+tombstone commits
  const batch = alice.batch();
  batch.delete(cRef);
  batch.set(tsRef, { c_c_scen2: "2026-09-15T00:00:00Z" }, { merge: true });
  await assertSucceeds(batch.commit());

  // 3. Document is deleted, and any further writes are rejected
  const postSnap = await cRef.get();
  assert.strictEqual(postSnap.exists, false);
  await assertFails(cRef.update({ name: "Another stale write" }));
  await assertFails(cRef.set(validChallenge));
});

test("parent tombstone cascade block: deleted challenge tombstone blocks new and updated child matches", async () => {
  const alice = asAlice();
  const cRef = alice.doc("users/alice/challenges/c_parent_tomb");
  const m1Ref = alice.doc("users/alice/challenges/c_parent_tomb/matches/m1");
  const mNewRef = alice.doc("users/alice/challenges/c_parent_tomb/matches/m_new");
  const tsRef = alice.doc("users/alice/meta/tombstones");

  await assertSucceeds(cRef.set(validChallenge));
  await assertSucceeds(m1Ref.set(validMatch));

  // Tombstone parent challenge only (simulating scenario before match cleanup batch arrives)
  await assertSucceeds(tsRef.set({ c_c_parent_tomb: "2026-09-15T00:00:00Z" }, { merge: true }));

  // Any attempt to update existing match m1 is rejected by parent tombstone rule
  await assertFails(m1Ref.update({ agent: "Reyna" }));

  // Any attempt to create new match m_new under tombstoned parent is rejected
  await assertFails(mNewRef.set({ ...validMatch, no: 2 }));
});

test("meta/tombstones append-only rules: document cannot be deleted", async () => {
  const alice = asAlice();
  const tsRef = alice.doc("users/alice/meta/tombstones");

  // Create initial tombstone
  await assertSucceeds(tsRef.set({ c_test: "2026-09-15T00:00:00Z" }));

  // Alice cannot delete the tombstones document
  await assertFails(tsRef.delete());
});

test("meta/tombstones append-only rules: existing keys cannot be removed or values altered", async () => {
  const alice = asAlice();
  const tsRef = alice.doc("users/alice/meta/tombstones");

  // Initial tombstone
  await assertSucceeds(tsRef.set({ c_orig: "2026-09-15T00:00:00Z" }));

  // Overwriting without c_orig (removal of existing key) is rejected
  await assertFails(tsRef.set({ c_new_only: "2026-09-15T00:00:00Z" }));

  // Modifying value of existing key is rejected
  await assertFails(tsRef.update({ c_orig: "2026-09-16T00:00:00Z" }));

  // Appending new key via set({ ... }, { merge: true }) succeeds
  await assertSucceeds(tsRef.set({ c_second: "2026-09-15T00:00:00Z" }, { merge: true }));

  // Appending new key via update succeeds
  await assertSucceeds(tsRef.update({ c_third: "2026-09-15T00:00:00Z" }));

  // Verify all 3 keys are present
  const snap = await tsRef.get();
  assert.ok(snap.data()?.c_orig);
  assert.ok(snap.data()?.c_second);
  assert.ok(snap.data()?.c_third);
});

test("generic meta documents remain writable while tombstones are protected", async () => {
  const alice = asAlice();
  const migRef = alice.doc("users/alice/meta/migration");

  // Alice can write and update normal meta documents like migration
  await assertSucceeds(migRef.set({ completedAt: "2026-09-15T00:00:00Z", challengeCount: 2 }));
  await assertSucceeds(migRef.update({ challengeCount: 3 }));
});

test("delete invariant: bare challenge delete without tombstone is rejected", async () => {
  const alice = asAlice();
  const cRef = alice.doc("users/alice/challenges/c_bare");
  await assertSucceeds(cRef.set(validChallenge));

  // Bare delete without tombstone must fail
  await assertFails(cRef.delete());

  // In a batch without tombstone, must also fail
  const b = alice.batch();
  b.delete(cRef);
  await assertFails(b.commit());
});

test("delete invariant: bare match delete without tombstone is rejected", async () => {
  const alice = asAlice();
  const cRef = alice.doc("users/alice/challenges/c1");
  const mRef = alice.doc("users/alice/challenges/c1/matches/m_bare");
  await assertSucceeds(cRef.set(validChallenge));
  await assertSucceeds(mRef.set(validMatch));

  // Bare delete without tombstone must fail
  await assertFails(mRef.delete());

  // In a batch without tombstone, must also fail
  const b = alice.batch();
  b.delete(mRef);
  await assertFails(b.commit());
});

test("delete invariant: delete with unrelated tombstone is rejected", async () => {
  const alice = asAlice();
  const cRef = alice.doc("users/alice/challenges/c1");
  const mRef = alice.doc("users/alice/challenges/c1/matches/m1");
  const tsRef = alice.doc("users/alice/meta/tombstones");
  await assertSucceeds(cRef.set(validChallenge));
  await assertSucceeds(mRef.set(validMatch));

  // Challenge delete paired with wrong tombstone key
  const b1 = alice.batch();
  b1.delete(cRef);
  b1.set(tsRef, { c_wrong_id: "2026-09-16T00:00:00Z" }, { merge: true });
  await assertFails(b1.commit());

  // Match delete paired with wrong tombstone key
  const b2 = alice.batch();
  b2.delete(mRef);
  b2.set(tsRef, { m_c1_wrong: "2026-09-16T00:00:00Z" }, { merge: true });
  await assertFails(b2.commit());
});

test("delete invariant: delete with matching tombstone in same batch succeeds", async () => {
  const alice = asAlice();
  const tsRef = alice.doc("users/alice/meta/tombstones");

  // Case A: Solo match deletion with m_<cId>_<mId> tombstone
  const c1Ref = alice.doc("users/alice/challenges/c1");
  const m1Ref = alice.doc("users/alice/challenges/c1/matches/m1");
  await assertSucceeds(c1Ref.set(validChallenge));
  await assertSucceeds(m1Ref.set(validMatch));

  const b1 = alice.batch();
  b1.delete(m1Ref);
  b1.set(tsRef, { m_c1_m1: "2026-09-16T00:00:00Z" }, { merge: true });
  await assertSucceeds(b1.commit());

  // Case B: Solo challenge deletion with c_<cId> tombstone
  const c2Ref = alice.doc("users/alice/challenges/c2");
  await assertSucceeds(c2Ref.set(validChallenge));

  const b2 = alice.batch();
  b2.delete(c2Ref);
  b2.set(tsRef, { c_c2: "2026-09-16T00:00:00Z" }, { merge: true });
  await assertSucceeds(b2.commit());

  // Case C: Cascade challenge deletion with matches using c_<cId> tombstone
  const c3Ref = alice.doc("users/alice/challenges/c3");
  const m3Ref = alice.doc("users/alice/challenges/c3/matches/m3");
  await assertSucceeds(c3Ref.set(validChallenge));
  await assertSucceeds(m3Ref.set(validMatch));

  const b3 = alice.batch();
  b3.delete(c3Ref);
  b3.delete(m3Ref);
  b3.set(tsRef, { c_c3: "2026-09-16T00:00:00Z" }, { merge: true });
  await assertSucceeds(b3.commit());
});

test("delete invariant: failed batch with delete and tombstone rolls back entirely", async () => {
  const alice = asAlice();
  const cRef = alice.doc("users/alice/challenges/c_rollback");
  const tsRef = alice.doc("users/alice/meta/tombstones");
  await assertSucceeds(cRef.set(validChallenge));

  // Batch contains valid delete + correct tombstone, but also an invalid operation (violates validChallenge rules)
  const b = alice.batch();
  b.delete(cRef);
  b.set(tsRef, { c_c_rollback: "2026-09-16T00:00:00Z" }, { merge: true });
  b.set(alice.doc("users/alice/challenges/c_invalid"), { name: "" }); // invalid: empty name
  await assertFails(b.commit());

  // Verify rollback: challenge document still exists
  const snapC = await cRef.get();
  assert.strictEqual(snapC.exists, true);

  // Verify rollback: tombstone document does not have c_c_rollback
  const snapTs = await tsRef.get();
  assert.strictEqual(snapTs.data()?.c_c_rollback, undefined);
});

test("delete invariant: subsequent write to tombstoned challenge or match is rejected", async () => {
  const alice = asAlice();
  const cRef = alice.doc("users/alice/challenges/c_stale");
  const mRef = alice.doc("users/alice/challenges/c_stale/matches/m1");
  const tsRef = alice.doc("users/alice/meta/tombstones");
  await assertSucceeds(cRef.set(validChallenge));
  await assertSucceeds(mRef.set(validMatch));

  // Valid atomic deletion of challenge and tombstone
  const b = alice.batch();
  b.delete(cRef);
  b.delete(mRef);
  b.set(tsRef, { c_c_stale: "2026-09-16T00:00:00Z" }, { merge: true });
  await assertSucceeds(b.commit());

  // Subsequent recreate of challenge is rejected
  await assertFails(cRef.set(validChallenge));

  // Subsequent recreate of match under tombstoned challenge is rejected
  await assertFails(mRef.set(validMatch));
});

test("delete invariant: tombstone merge maintains existing keys while appending new tombstone", async () => {
  const alice = asAlice();
  const tsRef = alice.doc("users/alice/meta/tombstones");
  await assertSucceeds(tsRef.set({ c_preexisting: "2026-09-15T00:00:00Z" }));

  const cRef = alice.doc("users/alice/challenges/c_newly_deleted");
  await assertSucceeds(cRef.set(validChallenge));

  const b = alice.batch();
  b.delete(cRef);
  b.set(tsRef, { c_c_newly_deleted: "2026-09-16T00:00:00Z" }, { merge: true });
  await assertSucceeds(b.commit());

  const snap = await tsRef.get();
  assert.strictEqual(snap.data()?.c_preexisting, "2026-09-15T00:00:00Z");
  assert.strictEqual(snap.data()?.c_c_newly_deleted, "2026-09-16T00:00:00Z");
});





