// Pure conversion between the app's three globals and flat Firestore document maps.
// No Firebase imports: this file must stay testable in plain Node.
(function (root, factory) {
  const api = factory(root);
  root.VCTSnapshotModel = api;
  Object.assign(root, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {

  const CHALLENGE_FIELDS = [
    "name", "target", "startRank", "startRR", "targetRank", "description"
  ];

  const MATCH_FIELDS = [
    "no", "date", "agent", "map", "result", "rankAfter", "rankStatus",
    "rrAfter", "rrChange", "myScore", "enemyScore", "rounds",
    "kills", "deaths", "assists", "ddDelta", "hs", "acs", "adr", "kast",
    "firstKills", "firstDeaths", "multiKills", "notes"
  ];

  function newMatchId() {
    if (root.crypto && typeof root.crypto.randomUUID === "function") {
      return root.crypto.randomUUID();
    }
    return `m_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function pick(source, fields) {
    const out = {};
    for (const key of fields) out[key] = source[key] === undefined ? null : source[key];
    return out;
  }

  function buildSnapshot(state) {
    const s = state || {};
    const data = s.data || null;
    const openId = data ? data.id : null;
    const challenges = {};
    const matches = {};

    function add(challenge, status) {
      if (!challenge || !challenge.id) return;
      const doc = pick(challenge, CHALLENGE_FIELDS);
      doc.status = status;
      doc.isOpen = status === "active" && challenge.id === openId;
      doc.archivedAt = challenge.archivedAt || null;
      challenges[challenge.id] = doc;

      const list = Array.isArray(challenge.matches) ? challenge.matches : [];
      for (const m of list) {
        if (!m || typeof m !== "object") continue;
        // Assigned in place so the id survives in the live object, not just the snapshot.
        if (!m.matchId) m.matchId = newMatchId();
        const md = pick(m, MATCH_FIELDS);
        md.source = m.source || "manual";
        md.riotMatchId = m.riotMatchId || null;
        matches[`${challenge.id}/${m.matchId}`] = md;
      }
    }

    for (const c of s.activeChallenges || []) add(c, "active");
    for (const c of s.archives || []) add(c, "archived");
    // `data` is normally also present in activeChallenges via syncCurrentChallenge(),
    // but persist() can be called before that sync in some paths.
    if (data && !challenges[data.id]) add(data, "active");

    return { challenges, matches };
  }

  function applyDocuments(challengeEntries, matchEntriesByChallenge) {
    if (!Array.isArray(challengeEntries)) return { data: null, activeChallenges: [], archives: [] };
    const matchesMap = matchEntriesByChallenge || {};
    const activeChallenges = [];
    const archives = [];
    let data = null;

    for (const entry of challengeEntries) {
      if (!entry || !entry.doc || typeof entry.doc !== "object") continue;
      const doc = entry.doc;
      const challenge = { id: entry.id };
      for (const key of CHALLENGE_FIELDS) {
        challenge[key] = doc[key] === undefined ? null : doc[key];
      }
      if (doc.archivedAt) challenge.archivedAt = doc.archivedAt;

      const rawRows = matchesMap[entry.id];
      const rows = Array.isArray(rawRows) ? rawRows : [];
      challenge.matches = rows
        .filter((r) => r && r.id && r.doc && typeof r.doc === "object")
        .map((row) => Object.assign({}, row.doc, { matchId: row.id }))
        .sort((a, b) => Number(a.no) - Number(b.no) || String(a.matchId || "").localeCompare(String(b.matchId || "")));

      if (doc.status === "archived") {
        archives.push(challenge);
      } else {
        activeChallenges.push(challenge);
        if (doc.isOpen) data = challenge;
      }
    }

    if (!data && activeChallenges.length) data = activeChallenges[0];
    return { data, activeChallenges, archives };
  }

  return { buildSnapshot, applyDocuments, newMatchId, CHALLENGE_FIELDS, MATCH_FIELDS };
});
