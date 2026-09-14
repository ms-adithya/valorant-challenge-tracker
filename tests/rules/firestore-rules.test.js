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


