// Bridges Firestore to the app's three globals. Loaded as a classic script,
// so all Firestore functions arrive via window.VCT.fx (set by firebase-boot.js).
(function () {
  let lastSyncedSnapshot = { challenges: {}, matches: {} };
  let hydrated = false;
  let pushing = false;
  let pushQueued = false;
  let tombstones = {};
  let lastRawEntries = null;
  let lastRawByChallenge = null;

  function userRoot(uid) {
    const vct = typeof window !== "undefined" ? window.VCT : null;
    const { fx, db } = vct || {};
    const targetUid = uid || (vct && vct.uid);
    if (!fx || !db || !targetUid) return null;
    return fx.doc(db, "users", targetUid);
  }

  function reconcileMatchNumbers(challenge) {
    if (!challenge || !Array.isArray(challenge.matches) || challenge.matches.length < 2) return false;
    challenge.matches.sort((a, b) => Number(a.no) - Number(b.no) || String(a.matchId || "").localeCompare(String(b.matchId || "")));
    const used = new Set();
    const duplicates = [];
    for (const m of challenge.matches) {
      const currentNo = Number(m.no);
      if (Number.isInteger(currentNo) && currentNo > 0 && !used.has(currentNo)) {
        used.add(currentNo);
      } else {
        duplicates.push(m);
      }
    }
    if (duplicates.length === 0) return false;

    let nextNo = 1;
    const reassignments = [];
    for (const m of duplicates) {
      while (used.has(nextNo)) nextNo++;
      const oldNo = m.no;
      m.no = nextNo;
      used.add(nextNo);
      reassignments.push({ oldNo, nextNo });
    }

    challenge.matches.sort((a, b) => Number(a.no) - Number(b.no) || String(a.matchId || "").localeCompare(String(b.matchId || "")));
    if (typeof window !== "undefined" && typeof window.showAppNotice === "function" && reassignments.length > 0) {
      const msg = reassignments.length === 1
        ? `Match #${reassignments[0].oldNo} was reassigned to #${reassignments[0].nextNo} because #${reassignments[0].oldNo} already exists.`
        : `${reassignments.length} matches were reassigned numbers because duplicate match numbers were detected.`;
      window.showAppNotice(msg, "Match numbers reconciled");
    }
    return true;
  }

  async function pushChanges() {
    const VCT = typeof window !== "undefined" ? window.VCT : null;
    if (!VCT || !VCT.uid || !VCT.fx) return;
    // Never write before the first snapshot lands, or an empty local state
    // would diff into a full delete of everything on the server.
    if (!hydrated) return;
    if (pushing) { pushQueued = true; return; }
    pushing = true;
    try {
      const buildSnap = (typeof window !== "undefined" && window.buildSnapshot) || (typeof window !== "undefined" && window.VCTSnapshotModel && window.VCTSnapshotModel.buildSnapshot);
      const diffSnap = (typeof window !== "undefined" && window.diffSnapshots) || (typeof window !== "undefined" && window.VCTSnapshotDiff && window.VCTSnapshotDiff.diffSnapshots);
      const chunkFn = (typeof window !== "undefined" && window.chunk) || (typeof window !== "undefined" && window.VCTSnapshotDiff && window.VCTSnapshotDiff.chunk) || ((arr, sz) => {
        const out = [];
        for (let i = 0; i < arr.length; i += sz) out.push(arr.slice(i, i + sz));
        return out;
      });

      const currentData = typeof data !== "undefined" ? data : (typeof window !== "undefined" ? window.data : undefined);
      const currentActive = typeof activeChallenges !== "undefined" ? activeChallenges : (typeof window !== "undefined" ? window.activeChallenges : []);
      const currentArchives = typeof archives !== "undefined" ? archives : (typeof window !== "undefined" ? window.archives : []);

      const next = buildSnap({
        data: currentData,
        activeChallenges: currentActive,
        archives: currentArchives,
      });
      const { creates, updates, deletes } = diffSnap(lastSyncedSnapshot, next);
      const changes = [
        ...creates.map((c) => Object.assign({}, c, { action: "create" })),
        ...updates.map((c) => Object.assign({}, c, { action: "update" })),
        ...deletes.map((c) => Object.assign({}, c, { action: "delete" })),
      ];
      if (!changes.length) return;

      const { fx, db, uid } = VCT;
      for (const part of chunkFn(changes, 400)) {
        const batch = fx.writeBatch(db);
        const challengesToTouch = new Set();
        const tombstoneUpdates = {};
        const createdChallenges = new Set(
          part.filter((c) => c.kind === "challenge" && c.action === "create").map((c) => c.key)
        );

        for (const change of part) {
          const ref = refFor(fx, db, uid, change);
          if (change.action === "create") {
            if (change.kind === "challenge" && tombstones["c_" + change.key]) continue;
            if (change.kind === "match") {
              const [cId, mId] = change.key.split("/");
              if (tombstones["c_" + cId] || tombstones["m_" + cId + "_" + mId]) continue;
              challengesToTouch.add(cId);
            }
            batch.set(ref, withTimestamps(fx, change.doc), { merge: false });
          } else if (change.action === "update") {
            if (change.kind === "challenge" && tombstones["c_" + change.key]) continue;
            if (change.kind === "match") {
              const [cId, mId] = change.key.split("/");
              if (tombstones["c_" + cId] || tombstones["m_" + cId + "_" + mId]) continue;
              challengesToTouch.add(cId);
            }
            // Use update rather than set: if the document was deleted on the server,
            // Firestore enforces existence precondition and rejects stale resurrection.
            batch.update(ref, withTimestamps(fx, change.doc));
          } else if (change.action === "delete") {
            batch.delete(ref);
            if (change.kind === "challenge") {
              tombstoneUpdates["c_" + change.key] = fx.serverTimestamp();
            } else if (change.kind === "match") {
              const [cId, mId] = change.key.split("/");
              tombstoneUpdates["m_" + cId + "_" + mId] = fx.serverTimestamp();
              challengesToTouch.add(cId);
            }
          }
        }

        // Subcollection writes do not notify parent collection listeners.
        // Touch parent challenge updatedAt so onSnapshot(challengesRef) fires across all clients.
        for (const cId of challengesToTouch) {
          if (!createdChallenges.has(cId) && !tombstones["c_" + cId]) {
            batch.update(fx.doc(db, "users", uid, "challenges", cId), { updatedAt: fx.serverTimestamp() });
          }
        }

        // Write durable tombstones under users/{uid}/meta/tombstones
        if (Object.keys(tombstoneUpdates).length > 0) {
          batch.set(fx.doc(db, "users", uid, "meta", "tombstones"), tombstoneUpdates, { merge: true });
        }

        await batch.commit();
      }
      lastSyncedSnapshot = next;
    } catch (err) {
      // A failed push is recoverable: lastSyncedSnapshot is not advanced, so
      // the next persist() re-diffs and retries the same changes.
      console.error("VCT: cloud push failed", err);
    } finally {
      pushing = false;
      if (pushQueued) { pushQueued = false; pushChanges(); }
    }
  }

  function refFor(fx, db, uid, change) {
    if (change.kind === "challenge") {
      return fx.doc(db, "users", uid, "challenges", change.key);
    }
    const [challengeId, matchId] = change.key.split("/");
    return fx.doc(db, "users", uid, "challenges", challengeId, "matches", matchId);
  }

  function withTimestamps(fx, doc) {
    return Object.assign({}, doc, { updatedAt: fx.serverTimestamp() });
  }

  async function start(uid) {
    const VCT = typeof window !== "undefined" ? window.VCT : null;
    if (!VCT || !VCT.fx || !VCT.db) return;
    const { fx, db } = VCT;
    const rootDoc = userRoot(uid);
    if (rootDoc) {
      await fx.setDoc(rootDoc, { schemaVersion: 1, updatedAt: fx.serverTimestamp() }, { merge: true });
    }

    // Subscribe to durable tombstones
    // Fetch initial tombstones before attaching challenge listener to eliminate race condition
    const tombstonesRef = fx.doc(db, "users", uid, "meta", "tombstones");
    try {
      const initSnap = await fx.getDoc(tombstonesRef);
      if (initSnap && initSnap.exists()) {
        tombstones = initSnap.data() || {};
      }
    } catch (err) {
      console.warn("VCT: initial tombstones fetch failed", err);
    }

    // Subscribe to durable tombstones for subsequent out-of-band updates
    fx.onSnapshot(tombstonesRef, (snap) => {
      if (snap && snap.exists()) {
        tombstones = snap.data() || {};
        const prevKeys = new Set(Object.keys(tombstones));
        const nextData = snap.data() || {};
        tombstones = nextData;
        const newKeys = Object.keys(nextData).filter((k) => !prevKeys.has(k));
        // If newly tombstoned items affect current in-memory challenge/match data, rehydrate immediately
        if (newKeys.length > 0 && lastRawEntries && lastRawByChallenge) {
          const filteredEntries = lastRawEntries.filter((entry) => !tombstones["c_" + entry.id]);
          const filteredByChallenge = {};
          for (const entry of filteredEntries) {
            const ms = lastRawByChallenge[entry.id] || [];
            filteredByChallenge[entry.id] = ms.filter((m) => !tombstones["m_" + entry.id + "_" + m.id]);
          }
          rehydrate(filteredEntries, filteredByChallenge);
        }
      }
    }, (err) => console.warn("VCT: tombstones subscription failed", err));

    let latestSnapshotSeq = 0;
    const challengesRef = fx.collection(db, "users", uid, "challenges");
    fx.onSnapshot(challengesRef, async (snap) => {
      const seq = ++latestSnapshotSeq;
      lastRawEntries = snap.docs.map((d) => ({ id: d.id, doc: d.data() }));
      const entries = lastRawEntries.filter((entry) => !tombstones["c_" + entry.id]);
      const byChallenge = {};
      await Promise.all(entries.map(async (entry) => {
        const matchesRef = fx.collection(db, "users", uid, "challenges", entry.id, "matches");
        const ms = await fx.getDocs(matchesRef);
        byChallenge[entry.id] = ms.docs
          .map((d) => ({ id: d.id, doc: d.data() }))
          .filter((m) => !tombstones["m_" + entry.id + "_" + m.id]);
      }));
      if (seq !== latestSnapshotSeq) return;
      lastRawByChallenge = byChallenge;
      rehydrate(entries, byChallenge);
    }, (err) => console.error("VCT: challenge subscription failed", err));
  }

  function rehydrate(entries, byChallenge) {
    // Nothing on the server yet: keep whatever localStorage gave us and let
    // migration (Task 7) push it up. Do NOT blank the app.
    if (!entries.length && !hydrated) { hydrated = true; return; }

    const applyDocs = (typeof window !== "undefined" && window.applyDocuments) || (typeof window !== "undefined" && window.VCTSnapshotModel && window.VCTSnapshotModel.applyDocuments);
    const buildSnap = (typeof window !== "undefined" && window.buildSnapshot) || (typeof window !== "undefined" && window.VCTSnapshotModel && window.VCTSnapshotModel.buildSnapshot);
    const state = applyDocs(entries, byChallenge);

    // Reconcile duplicate match numbers deterministically by matchId tie-break
    let anyRenumbered = false;
    for (const c of [...state.activeChallenges, ...state.archives]) {
      if (reconcileMatchNumbers(c)) anyRenumbered = true;
    }

    try { data = state.data; } catch (_) {}
    try { activeChallenges = state.activeChallenges; } catch (_) {}
    try { archives = state.archives; } catch (_) {}
    if (typeof window !== "undefined") {
      window.data = state.data;
      window.activeChallenges = state.activeChallenges;
      window.archives = state.archives;
    }

    // These run at parse time on the localStorage path; re-run them now that
    // the real data has arrived.
    const normFn = typeof normalizeStoredChallenges === "function"
      ? normalizeStoredChallenges
      : (typeof window !== "undefined" && typeof window.normalizeStoredChallenges === "function" ? window.normalizeStoredChallenges : null);
    if (normFn) normFn();

    // Snapshot after normalization so lastSyncedSnapshot reflects normalized fields
    lastSyncedSnapshot = buildSnap({
      data: typeof data !== "undefined" ? data : (typeof window !== "undefined" ? window.data : undefined),
      activeChallenges: typeof activeChallenges !== "undefined" ? activeChallenges : (typeof window !== "undefined" ? window.activeChallenges : []),
      archives: typeof archives !== "undefined" ? archives : (typeof window !== "undefined" ? window.archives : []),
    });
    hydrated = true;

    // Per Spec §3.2 (lines 91-96): After every successful sync, mirror back to
    // localStorage as last-known-good cache for first paint.
    const persistLocalFn = typeof persistLocal === "function"
      ? persistLocal
      : (typeof window !== "undefined" && typeof window.persistLocal === "function" ? window.persistLocal : null);
    if (persistLocalFn) persistLocalFn();

    if (anyRenumbered) {
      pushChanges();
    }

    const renderFn = typeof render === "function"
      ? render
      : (typeof window !== "undefined" && typeof window.render === "function" ? window.render : null);
    if (renderFn) renderFn();
  }

  const api = {
    pushChanges,
    start,
    reconcileMatchNumbers,
    get lastSyncedSnapshot() { return lastSyncedSnapshot; },
    get hydrated() { return hydrated; },
    get tombstones() { return tombstones; },
  };

  if (typeof window !== "undefined") {
    window.VCT = window.VCT || {};
    window.VCT.cloud = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
