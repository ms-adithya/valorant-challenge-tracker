const test = require("node:test");
const assert = require("node:assert");
const { countState, legacyFromRaw } = require("../js/cloud/cloud-migrate.js");

test("counts challenges and matches across all three buckets", () => {
  const state = {
    data: { id: "a", matches: [{ no: 1 }, { no: 2 }] },
    activeChallenges: [{ id: "a", matches: [{ no: 1 }, { no: 2 }] }],
    archives: [{ id: "b", matches: [{ no: 1 }] }],
  };
  // `data` is the same object as activeChallenges[0]; it must not be double-counted.
  assert.deepStrictEqual(countState(state), { challengeCount: 2, matchCount: 3 });
});

test("counts an open challenge missing from activeChallenges", () => {
  const state = {
    data: { id: "z", matches: [{ no: 1 }] },
    activeChallenges: [],
    archives: [],
  };
  assert.deepStrictEqual(countState(state), { challengeCount: 1, matchCount: 1 });
});

test("handles a completely empty state", () => {
  assert.deepStrictEqual(
    countState({ data: null, activeChallenges: [], archives: [] }),
    { challengeCount: 0, matchCount: 0 }
  );
});

test("falls back to the legacy vct2 key when vct4 is absent", () => {
  const raw = { vct4: null, vctActiveChallenges: null, vctArchives: null, vct2: { id: "old", matches: [] } };
  const state = legacyFromRaw(raw);
  assert.strictEqual(state.data.id, "old");
  assert.deepStrictEqual(state.archives, []);
});

test("coerces non-array buckets to arrays", () => {
  const raw = { vct4: null, vctActiveChallenges: "corrupt", vctArchives: 7, vct2: null };
  const state = legacyFromRaw(raw);
  assert.deepStrictEqual(state.activeChallenges, []);
  assert.deepStrictEqual(state.archives, []);
});

test("filters out non-object entities in legacy challenge arrays and matches", () => {
  const raw = {
    vct4: 12345, // primitive instead of object
    vctActiveChallenges: [null, 42, "corrupt", [], { id: "c1", matches: [null, "bad", { no: 1 }] }],
    vctArchives: [undefined, { id: "c2", matches: [] }],
    vct2: "fallback string",
  };
  const state = legacyFromRaw(raw);
  assert.strictEqual(state.data, null);
  assert.strictEqual(state.activeChallenges.length, 1);
  assert.strictEqual(state.activeChallenges[0].id, "c1");
  assert.strictEqual(state.archives.length, 1);
  assert.strictEqual(state.archives[0].id, "c2");

  const counts = countState(state);
  assert.strictEqual(counts.challengeCount, 2);
  assert.strictEqual(counts.matchCount, 3);
});
