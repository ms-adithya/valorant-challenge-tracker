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
  await assertFails(db.doc("users/alice/meta/tombstones").get());
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

