const test = require("node:test");
const assert = require("node:assert");
const { buildSnapshot, applyDocuments } = require("../js/cloud/snapshot-model.js");

const challenge = (over = {}) => ({
  id: "ch_1",
  name: "Road to Gold",
  target: 20,
  startRank: "Silver 2",
  startRR: 40,
  targetRank: "Gold 1",
  description: "",
  matches: [],
  ...over,
});

const match = (over = {}) => ({
  no: 1, date: "2026-09-06T10:00:00.000Z", agent: "Jett", map: "Ascent",
  result: "Win", rankAfter: "Silver 2", rankStatus: "Same Rank",
  rrAfter: 60, rrChange: 20, myScore: 13, enemyScore: 7, rounds: 20,
  kills: 20, deaths: 14, assists: 4, ddDelta: null, hs: 24, acs: 240,
  adr: 150, kast: 72, firstKills: null, firstDeaths: null,
  multiKills: null, notes: "", ...over,
});

test("flattens challenges into a document map", () => {
  const c = challenge();
  const snap = buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  assert.deepStrictEqual(Object.keys(snap.challenges), ["ch_1"]);
  assert.strictEqual(snap.challenges.ch_1.status, "active");
  assert.strictEqual(snap.challenges.ch_1.isOpen, true);
  assert.strictEqual(snap.challenges.ch_1.name, "Road to Gold");
});

test("marks only the open challenge as isOpen", () => {
  const a = challenge({ id: "ch_a" });
  const b = challenge({ id: "ch_b" });
  const snap = buildSnapshot({ data: b, activeChallenges: [a, b], archives: [] });
  assert.strictEqual(snap.challenges.ch_a.isOpen, false);
  assert.strictEqual(snap.challenges.ch_b.isOpen, true);
});

test("marks archived challenges and preserves archivedAt", () => {
  const a = challenge({ id: "ch_old", archivedAt: "2026-01-01T00:00:00.000Z" });
  const snap = buildSnapshot({ data: null, activeChallenges: [], archives: [a] });
  assert.strictEqual(snap.challenges.ch_old.status, "archived");
  assert.strictEqual(snap.challenges.ch_old.archivedAt, "2026-01-01T00:00:00.000Z");
});

test("assigns a matchId in place when missing and keeps it stable", () => {
  const c = challenge({ matches: [match()] });
  buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  const assigned = c.matches[0].matchId;
  assert.ok(typeof assigned === "string" && assigned.length > 0);
  buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  assert.strictEqual(c.matches[0].matchId, assigned);
});

test("keys matches by challengeId/matchId", () => {
  const c = challenge({ matches: [match({ matchId: "m_1" })] });
  const snap = buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  assert.deepStrictEqual(Object.keys(snap.matches), ["ch_1/m_1"]);
  assert.strictEqual(snap.matches["ch_1/m_1"].no, 1);
  assert.strictEqual(snap.matches["ch_1/m_1"].source, "manual");
});

test("preserves null optionals rather than coercing to zero", () => {
  const c = challenge({ matches: [match({ matchId: "m_1", rrAfter: null, rrChange: null })] });
  const snap = buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  assert.strictEqual(snap.matches["ch_1/m_1"].rrAfter, null);
  assert.strictEqual(snap.matches["ch_1/m_1"].rrChange, null);
});

test("round-trips back into the three globals", () => {
  const c = challenge({ matches: [match({ matchId: "m_1" })] });
  const snap = buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  const entries = Object.entries(snap.challenges).map(([id, doc]) => ({ id, doc }));
  const byChallenge = { ch_1: [{ id: "m_1", doc: snap.matches["ch_1/m_1"] }] };
  const state = applyDocuments(entries, byChallenge);
  assert.strictEqual(state.activeChallenges.length, 1);
  assert.strictEqual(state.archives.length, 0);
  assert.strictEqual(state.data.id, "ch_1");
  assert.strictEqual(state.data.matches.length, 1);
  assert.strictEqual(state.data.matches[0].no, 1);
});

test("sorts rehydrated matches by no", () => {
  const entries = [{ id: "ch_1", doc: { name: "x", target: 5, startRank: "Iron 1", startRR: 0, targetRank: null, description: "", status: "active", isOpen: true, archivedAt: null } }];
  const byChallenge = {
    ch_1: [
      { id: "m_b", doc: { ...match({ no: 3 }) } },
      { id: "m_a", doc: { ...match({ no: 1 }) } },
    ],
  };
  const state = applyDocuments(entries, byChallenge);
  assert.deepStrictEqual(state.data.matches.map((m) => m.no), [1, 3]);
});

test("falls back to the first active challenge when none is flagged open", () => {
  const entries = [{ id: "ch_1", doc: { name: "x", target: 5, startRank: "Iron 1", startRR: 0, targetRank: null, description: "", status: "active", isOpen: false, archivedAt: null } }];
  const state = applyDocuments(entries, {});
  assert.strictEqual(state.data.id, "ch_1");
});

test("breaks ties deterministically by matchId when match numbers collide", () => {
  const entries = [{ id: "ch_1", doc: { name: "x", target: 5, startRank: "Iron 1", startRR: 0, targetRank: null, description: "", status: "active", isOpen: true, archivedAt: null } }];
  const byChallenge = {
    ch_1: [
      { id: "m_z", doc: { ...match({ no: 1 }) } },
      { id: "m_a", doc: { ...match({ no: 1 }) } },
    ],
  };
  const state = applyDocuments(entries, byChallenge);
  assert.deepStrictEqual(state.data.matches.map((m) => m.matchId), ["m_a", "m_z"]);
});

test("reconciles duplicate match numbers deterministically", () => {
  const { reconcileMatchNumbers } = require("../js/cloud/cloud-sync.js");
  const c = challenge({
    matches: [
      { matchId: "m_a", no: 1 },
      { matchId: "m_z", no: 1 },
      { matchId: "m_c", no: 2 },
    ],
  });
  const renumbered = reconcileMatchNumbers(c);
  assert.strictEqual(renumbered, true);
  assert.deepStrictEqual(c.matches.map((m) => ({ id: m.matchId, no: m.no })), [
    { id: "m_a", no: 1 },
    { id: "m_z", no: 3 },
    { id: "m_c", no: 2 },
  ].sort((a, b) => a.no - b.no));
});
