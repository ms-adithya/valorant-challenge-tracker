const test = require("node:test");
const assert = require("node:assert");
const { buildSnapshot, applyDocuments } = require("../js/cloud/snapshot-model.js");
const { diffSnapshots, chunk } = require("../js/cloud/snapshot-diff.js");
const { reconcileMatchNumbers } = require("../js/cloud/cloud-sync.js");
const { legacyFromRaw, countState } = require("../js/cloud/cloud-migrate.js");
const { isValidChallengeDoc, sanitizeChallengeData } = require("../js/storage.js");
const { validateScoreArithmetic } = require("../js/match-validation.js");
const { validateRankTransition } = require("../js/rank-rules.js");
const { optionalNumber, normalizeMatchOptionals, persistLocal, persist, syncCurrentChallenge } = require("../js/persistence.js");
global.persist = persist;
const {
  openActiveChallenge,
  archiveActiveChallenge,
  deleteActiveById,
  deleteArchivedChallenge,
  unarchiveChallenge,
} = require("../js/challenge-actions.js");
const { cur, normalizeStoredChallenges } = require("../js/challenge-state.js");
const {
  rebuildChallengeRankProgression,
  challengeRankProgression,
  rankStateForMatch,
  latestRankState,
} = require("../js/rank-progression.js");
const { parseDelimited, normaliseImportedObject, validateImportedMatch } = require("../js/import-parse.js");
const { escapeJsSingleQuoted, escapeHtml } = require("../js/dom-utils.js");
const { countedMatches, getTablePage, getPaginationPages } = require("../js/match-dataset.js");

// ---------------------------------------------------------------------------
// 1. Corrupted Storage Recovery
// ---------------------------------------------------------------------------

test("storage recovery: rejects primitives and arrays as challenge documents", () => {
  assert.strictEqual(isValidChallengeDoc(null), false);
  assert.strictEqual(isValidChallengeDoc(undefined), false);
  assert.strictEqual(isValidChallengeDoc("corrupt-string"), false);
  assert.strictEqual(isValidChallengeDoc(12345), false);
  assert.strictEqual(isValidChallengeDoc(true), false);
  assert.strictEqual(isValidChallengeDoc([1, 2, 3]), false);
  assert.strictEqual(isValidChallengeDoc({ id: "c1", name: "Valid" }), true);
});

test("storage recovery: sanitizes missing or corrupt matches array on challenge", () => {
  const cNoMatches = { id: "c1", name: "No matches" };
  sanitizeChallengeData(cNoMatches);
  assert.ok(Array.isArray(cNoMatches.matches));
  assert.strictEqual(cNoMatches.matches.length, 0);

  const cBadMatches = { id: "c2", name: "Bad matches", matches: "not-an-array" };
  sanitizeChallengeData(cBadMatches);
  assert.ok(Array.isArray(cBadMatches.matches));
  assert.strictEqual(cBadMatches.matches.length, 0);

  const cCorruptElements = { id: "c3", name: "Corrupt items", matches: [null, 123, "bad", [], { no: 1 }] };
  sanitizeChallengeData(cCorruptElements);
  assert.strictEqual(cCorruptElements.matches.length, 1);
  assert.strictEqual(cCorruptElements.matches[0].no, 1);

  assert.strictEqual(sanitizeChallengeData(null), null);
  assert.strictEqual(sanitizeChallengeData("primitive"), null);
});

test("storage recovery: legacyFromRaw gracefully handles severely corrupt payloads", () => {
  const corruptPayload = {
    vct4: "bad_json_string_value",
    vctActiveChallenges: [null, 42, "invalid", { id: "c_good", name: "Good", matches: [null, 99, { no: 1 }] }],
    vctArchives: "not_an_array",
    vct2: true,
  };
  const state = legacyFromRaw(corruptPayload);
  assert.strictEqual(state.data, null);
  assert.strictEqual(state.activeChallenges.length, 1);
  assert.strictEqual(state.activeChallenges[0].id, "c_good");
  assert.deepStrictEqual(state.archives, []);
});

test("storage recovery: countState handles corrupt objects and primitives without throwing", () => {
  assert.deepStrictEqual(countState(null), { challengeCount: 0, matchCount: 0 });
  assert.deepStrictEqual(countState("corrupt"), { challengeCount: 0, matchCount: 0 });
  assert.deepStrictEqual(countState({ activeChallenges: [null, 123, "bad"], archives: [undefined] }), {
    challengeCount: 0,
    matchCount: 0,
  });
});

// ---------------------------------------------------------------------------
// 2. Snapshot Model Edge Cases
// ---------------------------------------------------------------------------

test("snapshot model: buildSnapshot ignores null or non-object match elements", () => {
  const c = {
    id: "ch_corrupt_matches",
    name: "Corrupt Matches Test",
    target: 10,
    startRank: "Silver 1",
    startRR: 50,
    matches: [
      null,
      undefined,
      "corrupted-string-match",
      42,
      { no: 1, agent: "Jett", map: "Ascent", result: "Win", myScore: 13, enemyScore: 5, rounds: 18 },
    ],
  };
  const snap = buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  assert.strictEqual(Object.keys(snap.challenges).length, 1);
  assert.strictEqual(Object.keys(snap.matches).length, 1);
  const matchDoc = Object.values(snap.matches)[0];
  assert.strictEqual(matchDoc.no, 1);
  assert.strictEqual(matchDoc.agent, "Jett");
});

test("snapshot model: buildSnapshot handles challenge with missing matches property", () => {
  const c = { id: "ch_no_matches", name: "No Matches Array", target: 5, startRank: "Iron 1", startRR: 0 };
  const snap = buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  assert.strictEqual(Object.keys(snap.challenges).length, 1);
  assert.strictEqual(Object.keys(snap.matches).length, 0);
});

test("snapshot model: buildSnapshot preserves source and riotMatchId fields", () => {
  const c = {
    id: "ch_riot",
    name: "Riot Source Test",
    target: 10,
    startRank: "Gold 1",
    startRR: 10,
    matches: [
      {
        matchId: "m_riot_1",
        no: 1,
        agent: "Omen",
        map: "Haven",
        result: "Win",
        source: "riot",
        riotMatchId: "val-match-uuid-12345",
      },
    ],
  };
  const snap = buildSnapshot({ data: c, activeChallenges: [c], archives: [] });
  assert.strictEqual(snap.matches["ch_riot/m_riot_1"].source, "riot");
  assert.strictEqual(snap.matches["ch_riot/m_riot_1"].riotMatchId, "val-match-uuid-12345");
});

test("snapshot model: applyDocuments returns empty state on invalid challengeEntries", () => {
  assert.deepStrictEqual(applyDocuments(null, {}), { data: null, activeChallenges: [], archives: [] });
  assert.deepStrictEqual(applyDocuments("not-an-array", {}), { data: null, activeChallenges: [], archives: [] });
  assert.deepStrictEqual(applyDocuments([], {}), { data: null, activeChallenges: [], archives: [] });
});

test("snapshot model: applyDocuments leaves data null when all challenges are archived", () => {
  const entries = [
    {
      id: "ch_archived_1",
      doc: {
        name: "Old 1",
        target: 10,
        startRank: "Bronze 1",
        startRR: 0,
        targetRank: null,
        description: "",
        status: "archived",
        isOpen: false,
        archivedAt: "2026-01-01T00:00:00.000Z",
      },
    },
    {
      id: "ch_archived_2",
      doc: {
        name: "Old 2",
        target: 10,
        startRank: "Bronze 2",
        startRR: 0,
        targetRank: null,
        description: "",
        status: "archived",
        isOpen: false,
        archivedAt: "2026-02-01T00:00:00.000Z",
      },
    },
  ];
  const state = applyDocuments(entries, {});
  assert.strictEqual(state.data, null);
  assert.strictEqual(state.activeChallenges.length, 0);
  assert.strictEqual(state.archives.length, 2);
});

test("snapshot model: applyDocuments skips malformed match and challenge entries", () => {
  const entries = [
    null,
    { id: "ch_broken", doc: null },
    {
      id: "ch_ok",
      doc: {
        name: "OK Challenge",
        target: 5,
        startRank: "Iron 1",
        startRR: 0,
        status: "active",
        isOpen: true,
      },
    },
  ];
  const byChallenge = {
    ch_ok: [
      null,
      { id: null, doc: {} },
      { id: "m_bad_doc", doc: null },
      { id: "m_ok", doc: { no: 1, agent: "Viper", map: "Breeze", result: "Win" } },
    ],
  };
  const state = applyDocuments(entries, byChallenge);
  assert.strictEqual(state.activeChallenges.length, 1);
  assert.strictEqual(state.data.id, "ch_ok");
  assert.strictEqual(state.data.matches.length, 1);
  assert.strictEqual(state.data.matches[0].matchId, "m_ok");
});

// ---------------------------------------------------------------------------
// 3. Diff Engine Edge Cases
// ---------------------------------------------------------------------------

test("snapshot diff: diffSnapshots handles empty snapshots gracefully", () => {
  const d = diffSnapshots({ challenges: {}, matches: {} }, { challenges: {}, matches: {} });
  assert.deepStrictEqual(d.creates, []);
  assert.deepStrictEqual(d.updates, []);
  assert.deepStrictEqual(d.deletes, []);
});

test("snapshot diff: diffSnapshots detects challenge deletion and sub-matches cleanup", () => {
  const prev = {
    challenges: {
      ch_1: { name: "Challenge 1", status: "active" },
      ch_2: { name: "Challenge 2", status: "active" },
    },
    matches: {
      "ch_1/m_1": { no: 1 },
      "ch_1/m_2": { no: 2 },
      "ch_2/m_1": { no: 1 },
    },
  };
  const next = {
    challenges: {
      ch_2: { name: "Challenge 2", status: "active" },
    },
    matches: {
      "ch_2/m_1": { no: 1 },
    },
  };
  const d = diffSnapshots(prev, next);
  assert.strictEqual(d.deletes.filter((x) => x.kind === "challenge").length, 1);
  assert.strictEqual(d.deletes.filter((x) => x.kind === "challenge")[0].key, "ch_1");
  const matchDeletes = d.deletes.filter((x) => x.kind === "match");
  assert.strictEqual(matchDeletes.length, 2);
  assert.ok(matchDeletes.some((m) => m.key === "ch_1/m_1"));
  assert.ok(matchDeletes.some((m) => m.key === "ch_1/m_2"));
});

test("snapshot diff: chunk handles boundary partition sizes correctly", () => {
  assert.deepStrictEqual(chunk([1, 2, 3], 5), [[1, 2, 3]]);
  assert.deepStrictEqual(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
  const bigArray = Array.from({ length: 1250 }, (_, i) => i);
  const parts = chunk(bigArray, 500);
  assert.strictEqual(parts.length, 3);
  assert.strictEqual(parts[0].length, 500);
  assert.strictEqual(parts[1].length, 500);
  assert.strictEqual(parts[2].length, 250);
});

// ---------------------------------------------------------------------------
// 4. Tie-breaking & Match Number Reconciliation
// ---------------------------------------------------------------------------

test("tie-breaking: reconcileMatchNumbers handles multiple duplicate collisions across gaps", () => {
  const challenge = {
    matches: [
      { matchId: "m_1", no: 1 },
      { matchId: "m_1_dup_a", no: 1 },
      { matchId: "m_1_dup_b", no: 1 },
      { matchId: "m_2", no: 2 },
      { matchId: "m_2_dup", no: 2 },
      { matchId: "m_5", no: 5 },
    ],
  };
  const changed = reconcileMatchNumbers(challenge);
  assert.strictEqual(changed, true);
  const numbers = challenge.matches.map((m) => m.no);
  // All match numbers must now be strictly unique and positive
  assert.strictEqual(new Set(numbers).size, challenge.matches.length);
  assert.ok(numbers.every((n) => Number.isInteger(n) && n >= 1));
  // Available gaps 3, 4, 6 were filled
  assert.deepStrictEqual(numbers.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
});

test("tie-breaking: reconcileMatchNumbers ignores empty or single-match challenges", () => {
  assert.strictEqual(reconcileMatchNumbers(null), false);
  assert.strictEqual(reconcileMatchNumbers({ matches: [] }), false);
  assert.strictEqual(reconcileMatchNumbers({ matches: [{ matchId: "m1", no: 1 }] }), false);
});

// ---------------------------------------------------------------------------
// 5. Score Arithmetic & Boundary Validation
// ---------------------------------------------------------------------------

test("boundary validation: score arithmetic rules for Win, Loss, Draw", () => {
  const errZero = validateScoreArithmetic(0, 0, "Draw", 0);
  assert.ok(errZero.some((e) => e.includes("0–0 score")));

  const errLoss = validateScoreArithmetic(13, 11, "Loss", 24);
  assert.ok(errLoss.some((e) => e.includes("Loss, your score must be lower")));

  const errWin = validateScoreArithmetic(8, 13, "Win", 21);
  assert.ok(errWin.some((e) => e.includes("Win, your score must be higher")));

  const errDraw = validateScoreArithmetic(12, 14, "Draw", 26);
  assert.ok(errDraw.some((e) => e.includes("Draw, both scores must be equal")));

  const errRounds = validateScoreArithmetic(13, 11, "Win", 25);
  assert.ok(errRounds.some((e) => e.includes("Rounds played must match the score")));

  const errNegative = validateScoreArithmetic(-1, 13, "Loss", 12);
  assert.ok(errNegative.some((e) => e.includes("Score values cannot be negative")));

  const errFloat = validateScoreArithmetic(13.5, 10, "Win", 23.5);
  assert.ok(errFloat.some((e) => e.includes("Score values must be whole numbers")));

  assert.deepStrictEqual(validateScoreArithmetic(13, 11, "Win", 24), []);
  assert.deepStrictEqual(validateScoreArithmetic(9, 13, "Loss", 22), []);
  assert.deepStrictEqual(validateScoreArithmetic(14, 14, "Draw", 28), []);
  assert.deepStrictEqual(validateScoreArithmetic(NaN, 13, "Loss", 22), ["Both score values are required numbers."]);
});

test("rank rules: validateRankTransition validates placements, promotions, demotions, and invalid transitions", () => {
  assert.strictEqual(validateRankTransition("InvalidRank", "Iron 1", "Placed"), "Select a recognised rank.");
  assert.strictEqual(validateRankTransition("Unranked", "Unranked", "Promoted"), "Placement is still unresolved, so rank status must remain Same Rank.");
  assert.strictEqual(validateRankTransition("Unranked", "Bronze 1", "Promoted"), "The first ranked result after Unranked must use Placed, not promotion or demotion.");
  assert.strictEqual(validateRankTransition("Unranked", "Bronze 1", "Placed"), "");
  assert.strictEqual(validateRankTransition("Bronze 1", "Unranked", "Demoted"), "A placed player cannot return to Unranked within the same challenge.");
  assert.strictEqual(validateRankTransition("Bronze 1", "Bronze 2", "Placed"), "Placed is only valid when the previous rank is Unranked.");
  assert.strictEqual(validateRankTransition("Silver 1", "Bronze 3", "Promoted"), "Promoted requires the ending rank to be higher than the previous rank.");
  assert.strictEqual(validateRankTransition("Bronze 2", "Bronze 3", "Demoted"), "Demoted requires the ending rank to be lower than the previous rank.");
  assert.strictEqual(validateRankTransition("Bronze 1", "Bronze 2", "Same Rank"), "Rank status is Same Rank, but the selected rank changed.");
  assert.strictEqual(validateRankTransition("Bronze 1", "Bronze 2", "Promoted"), "");
  assert.strictEqual(validateRankTransition("Silver 1", "Bronze 3", "Demoted"), "");
  assert.strictEqual(validateRankTransition("Silver 1", "Silver 1", "Same Rank"), "");
});

test("persistence: optionalNumber handles whitespace strings, null, and non-numerics safely", () => {
  assert.strictEqual(optionalNumber(null), null);
  assert.strictEqual(optionalNumber(undefined), null);
  assert.strictEqual(optionalNumber(""), null);
  assert.strictEqual(optionalNumber("   "), null);
  assert.strictEqual(optionalNumber("null"), null);
  assert.strictEqual(optionalNumber("  NULL  "), null);
  assert.strictEqual(optionalNumber("abc"), null);
  assert.strictEqual(optionalNumber(NaN), null);
  assert.strictEqual(optionalNumber(Infinity), null);
  assert.strictEqual(optionalNumber(0), 0);
  assert.strictEqual(optionalNumber("0"), 0);
  assert.strictEqual(optionalNumber(25), 25);
  assert.strictEqual(optionalNumber(" 25 "), 25);
  assert.strictEqual(optionalNumber(-10), -10);

  const match = { rrAfter: "  ", hs: " 24 ", kills: "null", notes: "text" };
  normalizeMatchOptionals(match);
  assert.strictEqual(match.rrAfter, null);
  assert.strictEqual(match.hs, 24);
  assert.strictEqual(match.kills, null);
});

test("persistence: persistLocal handles undefined localStorage and QuotaExceededError without throwing", () => {
  const origLocalStorage = global.localStorage;
  const origData = global.data;
  const origActive = global.activeChallenges;
  const origArchives = global.archives;
  try {
    global.data = { id: "c1", name: "Test" };
    global.activeChallenges = [global.data];
    global.archives = [];

    // 1. Undefined localStorage: returns false safely
    delete global.localStorage;
    assert.strictEqual(persistLocal(), false);

    // 2. Mock localStorage that succeeds
    const store = { vct4: '{"id":"c1"}', vctActiveChallenges: "[]", vctArchives: "[]" };
    global.localStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    };
    assert.strictEqual(persistLocal(), true);

    // 3. QuotaExceededError: rolls back and returns false without crashing
    store.vct4 = '{"id":"c1"}';
    global.localStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => {
        if (k === "vctActiveChallenges") {
          const quotaErr = new Error("Quota exceeded");
          quotaErr.name = "QuotaExceededError";
          throw quotaErr;
        }
        store[k] = v;
      },
      removeItem: (k) => { delete store[k]; },
    };
    assert.strictEqual(persistLocal(), false);
    // Verified that previous state for vct4 was restored after the partial write failed
    assert.strictEqual(store.vct4, '{"id":"c1"}');
  } finally {
    if (origLocalStorage !== undefined) {
      global.localStorage = origLocalStorage;
    } else {
      delete global.localStorage;
    }
    global.data = origData;
    global.activeChallenges = origActive;
    global.archives = origArchives;
  }
});

// ---------------------------------------------------------------------------
// 6. Challenge State & Rank Accessor Fallbacks
// ---------------------------------------------------------------------------

test("challenge state: cur() falls back cleanly to Unranked when startRank is null or undefined without throwing", () => {
  const origData = global.data;
  try {
    global.data = { id: "c_norank", name: "No Start Rank" };
    const res = cur();
    assert.strictEqual(res.rankAfter, "Unranked");
    assert.strictEqual(res.rrAfter, null);

    global.data = null;
    const resNull = cur();
    assert.strictEqual(resNull.rankAfter, "Unranked");
    assert.strictEqual(resNull.rrAfter, null);
  } finally {
    global.data = origData;
  }
});

test("challenge state: normalizeStoredChallenges tolerates null and corrupted non-object matches", () => {
  const c = {
    id: "c_corrupt_matches",
    name: "Corrupt Match Normalization",
    startRank: "Silver 1",
    matches: [null, undefined, 42, "bad", { no: 1, rankAfter: "Silver 2", rrAfter: 15, rrChange: 15 }],
  };
  const origActive = global.activeChallenges;
  const origArchives = global.archives;
  const origData = global.data;
  try {
    global.data = c;
    global.activeChallenges = [c];
    global.archives = [];
    assert.doesNotThrow(() => normalizeStoredChallenges());
    assert.strictEqual(c.matches[4].rankStatus, "Promoted");
  } finally {
    global.data = origData;
    global.activeChallenges = origActive;
    global.archives = origArchives;
  }
});

// ---------------------------------------------------------------------------
// 7. Challenge Lifecycle State Rollback on Persistence Failure
// ---------------------------------------------------------------------------

test("challenge lifecycle: openActiveChallenge rolls back data if persist() fails", () => {
  const origLocalStorage = global.localStorage;
  const origData = global.data;
  const origActive = global.activeChallenges;
  try {
    const c1 = { id: "ch_1", name: "Challenge 1", matches: [] };
    const c2 = { id: "ch_2", name: "Challenge 2", matches: [] };
    global.data = c1;
    global.activeChallenges = [c1, c2];

    // Mock localStorage throwing QuotaExceededError
    global.localStorage = {
      getItem: () => null,
      setItem: () => {
        const err = new Error("Quota exceeded");
        err.name = "QuotaExceededError";
        throw err;
      },
      removeItem: () => {},
    };

    openActiveChallenge("ch_2");
    // Since persist failed, data must be rolled back to c1
    assert.strictEqual(global.data.id, "ch_1");
  } finally {
    if (origLocalStorage !== undefined) global.localStorage = origLocalStorage;
    else delete global.localStorage;
    global.data = origData;
    global.activeChallenges = origActive;
  }
});

test("challenge lifecycle: archiveActiveChallenge rolls back activeChallenges, archives, and data if persist() fails", async () => {
  const origLocalStorage = global.localStorage;
  const origData = global.data;
  const origActive = global.activeChallenges;
  const origArchives = global.archives;
  try {
    const c1 = { id: "ch_1", name: "Challenge 1", matches: [] };
    const c2 = { id: "ch_2", name: "Challenge 2", matches: [] };
    global.data = c1;
    global.activeChallenges = [c1, c2];
    global.archives = [];

    // Failing localStorage
    global.localStorage = {
      getItem: () => null,
      setItem: () => {
        const err = new Error("Storage failure");
        throw err;
      },
      removeItem: () => {},
    };

    await archiveActiveChallenge("ch_1");
    // Rolls back: active challenges remain [c1, c2], archives remain empty, data remains c1
    assert.strictEqual(global.activeChallenges.length, 2);
    assert.strictEqual(global.activeChallenges[0].id, "ch_1");
    assert.strictEqual(global.archives.length, 0);
    assert.strictEqual(global.data.id, "ch_1");
  } finally {
    if (origLocalStorage !== undefined) global.localStorage = origLocalStorage;
    else delete global.localStorage;
    global.data = origData;
    global.activeChallenges = origActive;
    global.archives = origArchives;
  }
});

test("challenge lifecycle: deleteActiveById rolls back activeChallenges and data if persist() fails", async () => {
  const origLocalStorage = global.localStorage;
  const origData = global.data;
  const origActive = global.activeChallenges;
  try {
    const c1 = { id: "ch_1", name: "Challenge 1", matches: [] };
    const c2 = { id: "ch_2", name: "Challenge 2", matches: [] };
    global.data = c1;
    global.activeChallenges = [c1, c2];

    global.localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("Quota exceeded");
      },
      removeItem: () => {},
    };

    await deleteActiveById("ch_1");
    assert.strictEqual(global.activeChallenges.length, 2);
    assert.strictEqual(global.activeChallenges[0].id, "ch_1");
    assert.strictEqual(global.data.id, "ch_1");
  } finally {
    if (origLocalStorage !== undefined) global.localStorage = origLocalStorage;
    else delete global.localStorage;
    global.data = origData;
    global.activeChallenges = origActive;
  }
});

test("challenge lifecycle: deleteArchivedChallenge rolls back archives if persist() fails", async () => {
  const origLocalStorage = global.localStorage;
  const origArchives = global.archives;
  try {
    const arch1 = { id: "arch_1", name: "Archive 1", matches: [] };
    const arch2 = { id: "arch_2", name: "Archive 2", matches: [] };
    global.archives = [arch1, arch2];

    global.localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("Quota exceeded");
      },
      removeItem: () => {},
    };

    await deleteArchivedChallenge("arch_1");
    assert.strictEqual(global.archives.length, 2);
    assert.strictEqual(global.archives[0].id, "arch_1");
  } finally {
    if (origLocalStorage !== undefined) global.localStorage = origLocalStorage;
    else delete global.localStorage;
    global.archives = origArchives;
  }
});

test("challenge lifecycle: unarchiveChallenge rolls back archives, activeChallenges, and data if persist() fails", async () => {
  const origLocalStorage = global.localStorage;
  const origData = global.data;
  const origActive = global.activeChallenges;
  const origArchives = global.archives;
  try {
    const c1 = { id: "ch_1", name: "Active 1", matches: [] };
    const arch1 = { id: "arch_1", name: "Archive 1", matches: [], archivedAt: "2026-01-01" };
    global.data = c1;
    global.activeChallenges = [c1];
    global.archives = [arch1];

    global.localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("Storage write failed");
      },
      removeItem: () => {},
    };

    await unarchiveChallenge("arch_1");
    assert.strictEqual(global.archives.length, 1);
    assert.strictEqual(global.archives[0].id, "arch_1");
    assert.strictEqual(global.activeChallenges.length, 1);
    assert.strictEqual(global.activeChallenges[0].id, "ch_1");
    assert.strictEqual(global.data.id, "ch_1");
  } finally {
    if (origLocalStorage !== undefined) global.localStorage = origLocalStorage;
    else delete global.localStorage;
    global.data = origData;
    global.activeChallenges = origActive;
    global.archives = origArchives;
  }
});

// ---------------------------------------------------------------------------
// 8. Rank & RR Progression Runtime Derivation
// ---------------------------------------------------------------------------

test("rank progression: derives missing RR within same rank safely", () => {
  const c = {
    id: "ch_rr_derive",
    name: "RR Derivation Test",
    startRank: "Gold 1",
    startRR: 50,
    matches: [
      // Match 1: missing rrAfter, has change +18 -> derives afterRR = 68
      { no: 1, rankAfter: "Gold 1", rankStatus: "Same Rank", rrAfter: null, rrChange: 18 },
      // Match 2: missing rrChange, has rrAfter = 85 -> derives change = 85 - 68 = 17
      { no: 2, rankAfter: "Gold 1", rankStatus: "Same Rank", rrAfter: 85, rrChange: null },
      // Match 3: missing beforeRR, but here chain is intact: rrAfter 70, rrChange -15 -> confirms beforeRR 85
      { no: 3, rankAfter: "Gold 1", rankStatus: "Same Rank", rrAfter: 70, rrChange: -15 },
    ],
  };

  const states = rebuildChallengeRankProgression(c);
  assert.strictEqual(states.length, 3);

  // Match 1 assertions
  assert.strictEqual(states[0].matchNo, 1);
  assert.strictEqual(states[0].before.rr.value, 50);
  assert.strictEqual(states[0].before.rr.source, "recorded");
  assert.strictEqual(states[0].change.rr.value, 18);
  assert.strictEqual(states[0].change.rr.source, "recorded");
  assert.strictEqual(states[0].after.rr.value, 68);
  assert.strictEqual(states[0].after.rr.source, "derived");

  // Match 2 assertions
  assert.strictEqual(states[1].matchNo, 2);
  assert.strictEqual(states[1].before.rr.value, 68);
  assert.strictEqual(states[1].before.rr.source, "derived");
  assert.strictEqual(states[1].after.rr.value, 85);
  assert.strictEqual(states[1].after.rr.source, "recorded");
  assert.strictEqual(states[1].change.rr.value, 17);
  assert.strictEqual(states[1].change.rr.source, "derived");

  // Match 3 assertions
  assert.strictEqual(states[2].matchNo, 3);
  assert.strictEqual(states[2].before.rr.value, 85);
  assert.strictEqual(states[2].change.rr.value, -15);
  assert.strictEqual(states[2].after.rr.value, 70);
});

test("rank progression: strictly avoids guessing RR across rank transitions", () => {
  const c = {
    id: "ch_rr_boundary",
    name: "RR Boundary Test",
    startRank: "Gold 1",
    startRR: 85,
    matches: [
      // Match 1: Promotion to Gold 2, missing rrAfter, change +20
      // Boundary transition: must NOT guess afterRR
      { no: 1, rankAfter: "Gold 2", rankStatus: "Promoted", rrAfter: null, rrChange: 20 },
      // Match 2: In Gold 2, but previous afterRR was unknown -> chain is broken!
      { no: 2, rankAfter: "Gold 2", rankStatus: "Same Rank", rrAfter: null, rrChange: 15 },
    ],
  };

  const states = rebuildChallengeRankProgression(c);
  assert.strictEqual(states.length, 2);

  // Match 1: Promoted across boundary
  assert.strictEqual(states[0].before.rank.value, "Gold 1");
  assert.strictEqual(states[0].after.rank.value, "Gold 2");
  assert.strictEqual(states[0].event.value, "Promoted");
  assert.strictEqual(states[0].after.rr.value, null);
  assert.strictEqual(states[0].after.rr.source, "unknown");

  // Match 2: Unlinked anchor because previous afterRR was unknown
  assert.strictEqual(states[1].before.rr.value, null);
  assert.strictEqual(states[1].before.rr.source, "unknown");
  assert.strictEqual(states[1].after.rr.value, null);
  assert.strictEqual(states[1].after.rr.source, "unknown");
});

test("rank progression: handles unlinked anchors and placement from Unranked", () => {
  const c = {
    id: "ch_placement",
    name: "Placement Test",
    startRank: "Unranked",
    startRR: null,
    matches: [
      // Match 1: Still Unranked
      { no: 1, rankAfter: "Unranked", rankStatus: "Same Rank", rrAfter: null },
      // Match 2: Placed into Silver 1 with recorded 50 RR
      { no: 2, rankAfter: "Silver 1", rankStatus: "Placed", rrAfter: 50, rrChange: null },
      // Match 3: Gap with no RR info recorded -> breaks chain
      { no: 3, rankAfter: "Silver 1", rankStatus: "Same Rank", rrAfter: null, rrChange: null },
      // Match 4: Re-anchors with recorded 65 RR
      { no: 4, rankAfter: "Silver 1", rankStatus: "Same Rank", rrAfter: 65, rrChange: null },
    ],
  };

  const states = rebuildChallengeRankProgression(c);
  assert.strictEqual(states.length, 4);

  // Match 1
  assert.strictEqual(states[0].event.value, "Same Rank");
  assert.strictEqual(states[0].before.rr.value, null);
  assert.strictEqual(states[0].after.rr.value, null);

  // Match 2: Placed
  assert.strictEqual(states[1].event.value, "Placed");
  assert.strictEqual(states[1].before.rr.value, null);
  assert.strictEqual(states[1].after.rr.value, 50);
  assert.strictEqual(states[1].after.rr.source, "recorded");

  // Match 3: Missing RR breaks chain
  assert.strictEqual(states[2].before.rr.value, 50);
  assert.strictEqual(states[2].after.rr.value, null);
  assert.strictEqual(states[2].after.rr.source, "unknown");

  // Match 4: Re-anchored
  assert.strictEqual(states[3].before.rr.value, null);
  assert.strictEqual(states[3].before.rr.source, "unknown");
  assert.strictEqual(states[3].after.rr.value, 65);
  assert.strictEqual(states[3].after.rr.source, "recorded");

  // Helper function lookups
  assert.strictEqual(rankStateForMatch(2, c).event.value, "Placed");
  assert.strictEqual(latestRankState(c).matchNo, 4);
});

test("rank progression: tolerates corrupt matches and handles empty or missing challenge", () => {
  assert.deepStrictEqual(rebuildChallengeRankProgression(null), []);
  assert.deepStrictEqual(rebuildChallengeRankProgression({ matches: null }), []);
  assert.deepStrictEqual(challengeRankProgression(null), []);

  const corruptChallenge = {
    id: "ch_corrupt",
    startRank: null,
    startRR: null,
    matches: [null, undefined, "not_an_object", 42, { no: 1, rankAfter: "Iron 1", rrAfter: 20 }],
  };
  const states = rebuildChallengeRankProgression(corruptChallenge);
  assert.strictEqual(states.length, 1);
  assert.strictEqual(states[0].matchNo, 1);
  assert.strictEqual(states[0].before.rank.value, "Unranked");
  assert.strictEqual(states[0].after.rank.value, "Iron 1");
});

// ---------------------------------------------------------------------------
// 9. Persistence Happy Path & Synchronization
// ---------------------------------------------------------------------------

test("persistence: persist() succeeds and syncCurrentChallenge synchronizes active challenge", () => {
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

    const c1 = { id: "ch_active_1", name: "Challenge 1", matches: [] };
    global.data = c1;
    global.activeChallenges = [];
    global.archives = [];

    // Test syncCurrentChallenge() directly
    syncCurrentChallenge();
    assert.strictEqual(global.activeChallenges.length, 1);
    assert.strictEqual(global.activeChallenges[0].id, "ch_active_1");

    // Mutate data and verify syncCurrentChallenge replaces existing
    global.data.name = "Challenge 1 Updated";
    syncCurrentChallenge();
    assert.strictEqual(global.activeChallenges.length, 1);
    assert.strictEqual(global.activeChallenges[0].name, "Challenge 1 Updated");

    // Call persist() and assert it returns true
    const success = persist();
    assert.strictEqual(success, true);
    assert.ok(typeof store.vct4 === "string");
    assert.ok(typeof store.vctActiveChallenges === "string");
    assert.ok(typeof store.vctArchives === "string");
    assert.strictEqual(JSON.parse(store.vct4).name, "Challenge 1 Updated");
  } finally {
    if (origLocalStorage !== undefined) global.localStorage = origLocalStorage;
    else delete global.localStorage;
    global.data = origData;
    global.activeChallenges = origActive;
    global.archives = origArchives;
  }
});

// ---------------------------------------------------------------------------
// 10. Challenge Lifecycle Happy Paths
// ---------------------------------------------------------------------------

test("challenge lifecycle happy path: openActiveChallenge switches active challenge", () => {
  const origLocalStorage = global.localStorage;
  const origData = global.data;
  const origActive = global.activeChallenges;
  try {
    const store = {};
    global.localStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    };
    const c1 = { id: "ch_1", name: "Challenge 1", matches: [] };
    const c2 = { id: "ch_2", name: "Challenge 2", matches: [] };
    global.data = c1;
    global.activeChallenges = [c1, c2];

    openActiveChallenge("ch_2");
    assert.strictEqual(global.data.id, "ch_2");
  } finally {
    if (origLocalStorage !== undefined) global.localStorage = origLocalStorage;
    else delete global.localStorage;
    global.data = origData;
    global.activeChallenges = origActive;
  }
});

test("challenge lifecycle happy path: archiveActiveChallenge and unarchiveChallenge", async () => {
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
    const c1 = { id: "ch_1", name: "Challenge 1", matches: [] };
    const c2 = { id: "ch_2", name: "Challenge 2", matches: [] };
    global.data = c1;
    global.activeChallenges = [c1, c2];
    global.archives = [];

    // Archive c1
    await archiveActiveChallenge("ch_1");
    assert.strictEqual(global.activeChallenges.length, 1);
    assert.strictEqual(global.activeChallenges[0].id, "ch_2");
    assert.strictEqual(global.archives.length, 1);
    assert.strictEqual(global.archives[0].id, "ch_1");
    assert.ok(typeof global.archives[0].archivedAt === "string");
    assert.strictEqual(global.data.id, "ch_2");

    // Unarchive c1
    await unarchiveChallenge("ch_1");
    assert.strictEqual(global.archives.length, 0);
    assert.strictEqual(global.activeChallenges.length, 2);
    assert.strictEqual(global.data.id, "ch_1");
    assert.strictEqual(global.data.archivedAt, undefined);
  } finally {
    if (origLocalStorage !== undefined) global.localStorage = origLocalStorage;
    else delete global.localStorage;
    global.data = origData;
    global.activeChallenges = origActive;
    global.archives = origArchives;
  }
});

test("challenge lifecycle happy path: deleteActiveById and deleteArchivedChallenge", async () => {
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
    const c1 = { id: "ch_1", name: "Challenge 1", matches: [] };
    const c2 = { id: "ch_2", name: "Challenge 2", matches: [] };
    const arch1 = { id: "arch_1", name: "Archive 1", matches: [] };
    global.data = c1;
    global.activeChallenges = [c1, c2];
    global.archives = [arch1];

    // Delete active c1
    await deleteActiveById("ch_1");
    assert.strictEqual(global.activeChallenges.length, 1);
    assert.strictEqual(global.activeChallenges[0].id, "ch_2");
    assert.strictEqual(global.data.id, "ch_2");

    // Delete archived arch1
    await deleteArchivedChallenge("arch_1");
    assert.strictEqual(global.archives.length, 0);
  } finally {
    if (origLocalStorage !== undefined) global.localStorage = origLocalStorage;
    else delete global.localStorage;
    global.data = origData;
    global.activeChallenges = origActive;
    global.archives = origArchives;
  }
});

// ---------------------------------------------------------------------------
// 11. Match Metadata Preservation on Edit
// ---------------------------------------------------------------------------

test("match edit: preserves matchId, source, and riotMatchId across edits", () => {
  const originalMatch = {
    matchId: "m_stable_uuid_123",
    no: 1,
    date: "2026-09-01T12:00:00.000Z",
    agent: "Jett",
    map: "Ascent",
    result: "Win",
    source: "riot",
    riotMatchId: "val_match_uuid_999",
  };
  const challenge = {
    id: "ch_preserve",
    name: "Metadata Preservation",
    startRank: "Silver 1",
    startRR: 50,
    matches: [originalMatch],
  };

  // Simulate edit preserving metadata (logic from match-save.js)
  const edit = 1;
  const existing = edit ? challenge.matches.find((x) => Number(x.no) === edit) : null;
  const updatedMatch = {
    matchId: existing?.matchId || undefined,
    no: 1,
    date: existing?.date || new Date().toISOString(),
    agent: "Omen", // edited agent
    map: "Ascent",
    result: "Win",
    source: existing?.source || "manual",
    riotMatchId: existing?.riotMatchId || null,
  };
  if (!updatedMatch.matchId) delete updatedMatch.matchId;

  assert.strictEqual(updatedMatch.matchId, "m_stable_uuid_123");
  assert.strictEqual(updatedMatch.source, "riot");
  assert.strictEqual(updatedMatch.riotMatchId, "val_match_uuid_999");
  assert.strictEqual(updatedMatch.date, "2026-09-01T12:00:00.000Z");
  assert.strictEqual(updatedMatch.agent, "Omen");

  // Verify diff against previous snapshot detects an UPDATE, not a DELETE + CREATE
  const snap1 = buildSnapshot({ data: challenge, activeChallenges: [challenge], archives: [] });
  challenge.matches[0] = updatedMatch;
  const snap2 = buildSnapshot({ data: challenge, activeChallenges: [challenge], archives: [] });

  const diff = diffSnapshots(snap1, snap2);
  assert.strictEqual(diff.creates.length, 0);
  assert.strictEqual(diff.deletes.length, 0);
  assert.strictEqual(diff.updates.length, 1);
  assert.strictEqual(diff.updates[0].key, "ch_preserve/m_stable_uuid_123");
  assert.strictEqual(diff.updates[0].doc.agent, "Omen");
});

// ---------------------------------------------------------------------------
// 12. Match Import Validation & Parsing
// ---------------------------------------------------------------------------

test("import validation: validateImportedMatch rejects negative and fractional scores", () => {
  const previous = { rankAfter: "Iron 1", rrAfter: 50 };
  
  // Negative score rejected
  const resNeg = validateImportedMatch({
    agent: "Jett",
    map: "Ascent",
    result: "Loss",
    myScore: -1,
    enemyScore: 13,
    rankAfter: "Iron 1",
    rounds: 12
  }, previous, 1);
  assert.ok(resNeg.errors.some((e) => e.includes("Score values cannot be negative")));

  // Fractional score rejected
  const resFloat = validateImportedMatch({
    agent: "Jett",
    map: "Ascent",
    result: "Win",
    myScore: 13.5,
    enemyScore: 10,
    rankAfter: "Iron 1",
    rounds: 23.5
  }, previous, 1);
  assert.ok(resFloat.errors.some((e) => e.includes("Score values must be whole numbers")));

  // 0-0 completed match rejected
  const resZero = validateImportedMatch({
    agent: "Jett",
    map: "Ascent",
    result: "Draw",
    myScore: 0,
    enemyScore: 0,
    rankAfter: "Iron 1",
    rounds: 0
  }, previous, 1);
  assert.ok(resZero.errors.some((e) => e.includes("0–0")));

  // Valid row accepted cleanly
  const resValid = validateImportedMatch({
    agent: "Jett",
    map: "Ascent",
    result: "Win",
    myScore: 13,
    enemyScore: 10,
    rankAfter: "Iron 1",
    rankStatus: "Same Rank",
    rounds: 23
  }, previous, 1);
  assert.strictEqual(resValid.errors.length, 0);
  assert.strictEqual(resValid.match.myScore, 13);
  assert.strictEqual(resValid.match.enemyScore, 10);
});

test("import parsing: parseDelimited and normaliseImportedObject correctly parse CSV/TSV", () => {
  const csvText = 'Match,Agent,Map,Result,Score,Rank After\n1,Jett,"Ascent, Haven",Win,13-5,Bronze 1\n';
  const rows = parseDelimited(csvText, ",");
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[1][2], "Ascent, Haven");

  const headers = rows[0];
  const obj = Object.fromEntries(headers.map((h, i) => [h, rows[1][i] ?? ""]));
  const norm = normaliseImportedObject(obj);
  assert.strictEqual(norm.no, "1");
  assert.strictEqual(norm.agent, "Jett");
  assert.strictEqual(norm.map, "Ascent, Haven");
  assert.strictEqual(norm.myScore, "13");
  assert.strictEqual(norm.enemyScore, "5");
  assert.strictEqual(norm.rankAfter, "Bronze 1");
});

// ---------------------------------------------------------------------------
// 13. Match Dataset Resilience & Pagination
// ---------------------------------------------------------------------------

test("match dataset: countedMatches filters null and non-object corrupted elements", () => {
  const origData = global.data;
  try {
    global.data = {
      id: "ch_corrupt",
      matches: [null, undefined, "not-an-object", 42, [], { no: 1, result: "Win" }, { no: 2, result: "Loss" }]
    };
    const valid = countedMatches();
    assert.strictEqual(valid.length, 2);
    assert.strictEqual(valid[0].no, 1);
    assert.strictEqual(valid[1].no, 2);

    global.data = null;
    assert.deepStrictEqual(countedMatches(), []);

    global.data = { matches: "not-an-array" };
    assert.deepStrictEqual(countedMatches(), []);
  } finally {
    global.data = origData;
  }
});

test("match table pagination: getTablePage and getPaginationPages boundary calculations", () => {
  const items = Array.from({ length: 65 }, (_, i) => ({ no: i + 1 }));

  // Page 1 of 3 (size 25)
  const p1 = getTablePage(items, "25", 1);
  assert.strictEqual(p1.page, 1);
  assert.strictEqual(p1.pages, 3);
  assert.strictEqual(p1.start, 0);
  assert.strictEqual(p1.paged.length, 25);

  // Last page: Page 3 of 3 (size 25) -> 15 items left
  const p3 = getTablePage(items, "25", 3);
  assert.strictEqual(p3.page, 3);
  assert.strictEqual(p3.start, 50);
  assert.strictEqual(p3.paged.length, 15);

  // Out of bounds page clamps safely
  const pClamped = getTablePage(items, "25", 999);
  assert.strictEqual(pClamped.page, 3);

  // 'all' page size
  const pAll = getTablePage(items, "all", 1);
  assert.strictEqual(pAll.pages, 1);
  assert.strictEqual(pAll.paged.length, 65);

  // Pagination controls numbering
  assert.deepStrictEqual(getPaginationPages(1, 5), [1, 2, 3, 4, 5]);
  const bigPages = getPaginationPages(8, 15);
  assert.strictEqual(bigPages[0], 1);
  assert.strictEqual(bigPages[1], "left");
  assert.strictEqual(bigPages.at(-2), "right");
  assert.strictEqual(bigPages.at(-1), 15);
});

// ---------------------------------------------------------------------------
// 14. Escaping & Attribute Boundary Safety
// ---------------------------------------------------------------------------

test("dom utils: escapeJsSingleQuoted escapes single and double quotes to prevent attribute breakout", () => {
  assert.strictEqual(escapeJsSingleQuoted("normal"), "normal");
  assert.strictEqual(escapeJsSingleQuoted("it's"), "it\\'s");
  assert.strictEqual(escapeJsSingleQuoted('ch"onclick="alert(1)'), 'ch&quot;onclick=&quot;alert(1)');
  assert.strictEqual(escapeJsSingleQuoted("multi\nline\rtext"), "multi\\nline\\rtext");

  // Verify escapeHtml behaves as expected
  assert.strictEqual(escapeHtml('<script>alert("xss")</script>'), "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
});

// ---------------------------------------------------------------------------
// 15. Challenge Target Validation
// ---------------------------------------------------------------------------

test("challenge target validation: rejects non-integer and non-positive targets", () => {
  const isValidTarget = (target) => Boolean(target && target >= 1 && Number.isInteger(target));
  assert.strictEqual(isValidTarget(10), true);
  assert.strictEqual(isValidTarget(1), true);
  assert.strictEqual(isValidTarget(30), true);
  assert.strictEqual(isValidTarget(0), false);
  assert.strictEqual(isValidTarget(-5), false);
  assert.strictEqual(isValidTarget(10.5), false);
  assert.strictEqual(isValidTarget(NaN), false);
  assert.strictEqual(isValidTarget(Infinity), false);
  assert.strictEqual(isValidTarget(null), false);
});

