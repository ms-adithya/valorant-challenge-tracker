const test = require("node:test");
const assert = require("node:assert");
const { diffSnapshots, chunk } = require("../js/cloud/snapshot-diff.js");

const empty = () => ({ challenges: {}, matches: {} });
const withChallenge = (id, doc = {}) => ({
  challenges: { [id]: { name: "A", status: "active", isOpen: true, ...doc } },
  matches: {},
});

test("no changes produces an empty write set", () => {
  const snap = withChallenge("ch_1");
  const d = diffSnapshots(snap, JSON.parse(JSON.stringify(snap)));
  assert.deepStrictEqual(d.creates, []);
  assert.deepStrictEqual(d.updates, []);
  assert.deepStrictEqual(d.deletes, []);
});

test("a new challenge is a create", () => {
  const d = diffSnapshots(empty(), withChallenge("ch_1"));
  assert.strictEqual(d.creates.length, 1);
  assert.strictEqual(d.creates[0].kind, "challenge");
  assert.strictEqual(d.creates[0].key, "ch_1");
});

test("a changed field is an update, not a create", () => {
  const d = diffSnapshots(withChallenge("ch_1"), withChallenge("ch_1", { name: "B" }));
  assert.strictEqual(d.creates.length, 0);
  assert.strictEqual(d.updates.length, 1);
  assert.strictEqual(d.updates[0].doc.name, "B");
});

test("a removed challenge is a delete", () => {
  const d = diffSnapshots(withChallenge("ch_1"), empty());
  assert.strictEqual(d.deletes.length, 1);
  assert.strictEqual(d.deletes[0].key, "ch_1");
});

test("deleting a challenge also emits deletes for its matches", () => {
  const prev = {
    challenges: { ch_1: { name: "A" } },
    matches: { "ch_1/m_1": { no: 1 }, "ch_1/m_2": { no: 2 } },
  };
  const d = diffSnapshots(prev, empty());
  const matchDeletes = d.deletes.filter((x) => x.kind === "match");
  assert.strictEqual(matchDeletes.length, 2);
});

test("null and undefined are treated as equal so optionals do not churn", () => {
  const prev = { challenges: {}, matches: { "ch_1/m_1": { no: 1, rrAfter: null } } };
  const next = { challenges: {}, matches: { "ch_1/m_1": { no: 1, rrAfter: undefined } } };
  assert.deepStrictEqual(diffSnapshots(prev, next).updates, []);
});

test("a real value change on an optional is detected", () => {
  const prev = { challenges: {}, matches: { "ch_1/m_1": { no: 1, rrAfter: null } } };
  const next = { challenges: {}, matches: { "ch_1/m_1": { no: 1, rrAfter: 0 } } };
  assert.strictEqual(diffSnapshots(prev, next).updates.length, 1);
});

test("adding a field counts as a change", () => {
  const prev = { challenges: {}, matches: { "ch_1/m_1": { no: 1 } } };
  const next = { challenges: {}, matches: { "ch_1/m_1": { no: 1, notes: "gg" } } };
  assert.strictEqual(diffSnapshots(prev, next).updates.length, 1);
});

test("chunk splits to the Firestore batch limit", () => {
  const items = Array.from({ length: 1100 }, (_, i) => i);
  const parts = chunk(items, 500);
  assert.deepStrictEqual(parts.map((p) => p.length), [500, 500, 100]);
});

test("chunk returns nothing for an empty array", () => {
  assert.deepStrictEqual(chunk([], 500), []);
});
