// One-time localStorage -> Firestore migration, guarded by users/{uid}/meta/migration.
// Copies; never deletes the legacy keys.
(function (root, factory) {
  const api = factory(root);
  root.VCTMigrate = api;
  root.VCT = root.VCT || {};
  root.VCT.migrate = api;
  Object.assign(root, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {

  function ensureChallengeId(c) {
    if (!c || typeof c !== "object") return c;
    if (!c.id) {
      c.id = (root.crypto && typeof root.crypto.randomUUID === "function")
        ? `c_${root.crypto.randomUUID()}`
        : `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    return c;
  }

  function legacyFromRaw(raw) {
    if (!raw || typeof raw !== "object") return { data: null, activeChallenges: [], archives: [] };
    let data = (raw.vct4 && typeof raw.vct4 === "object" && !Array.isArray(raw.vct4)) ? raw.vct4 : null;
    if (!data && raw.vct2 && typeof raw.vct2 === "object" && !Array.isArray(raw.vct2)) data = raw.vct2;
    if (data) ensureChallengeId(data);
    const activeChallenges = Array.isArray(raw.vctActiveChallenges)
      ? raw.vctActiveChallenges.filter((c) => c && typeof c === "object" && !Array.isArray(c)).map(ensureChallengeId)
      : [];
    const archives = Array.isArray(raw.vctArchives)
      ? raw.vctArchives.filter((c) => c && typeof c === "object" && !Array.isArray(c)).map(ensureChallengeId)
      : [];
    return { data, activeChallenges, archives };
  }

  function countState(state) {
    if (!state) return { challengeCount: 0, matchCount: 0 };
    const seen = new Map();
    const add = (c) => {
      if (!c || typeof c !== "object" || Array.isArray(c)) return;
      ensureChallengeId(c);
      if (c.id && !seen.has(c.id)) seen.set(c.id, c);
    };
    (Array.isArray(state.activeChallenges) ? state.activeChallenges : []).forEach(add);
    (Array.isArray(state.archives) ? state.archives : []).forEach(add);
    if (state.data && !Array.isArray(state.data)) add(state.data);
    let matchCount = 0;
    for (const c of seen.values()) {
      matchCount += Array.isArray(c.matches) ? c.matches.length : 0;
    }
    return { challengeCount: seen.size, matchCount };
  }

  function readLegacyState() {
    const readKey = (key) => {
      try {
        if (!root.localStorage) return null;
        const value = root.localStorage.getItem(key);
        return value === null ? null : JSON.parse(value);
      } catch (err) {
        console.warn(`VCT: could not read ${key}`, err);
        return null;
      }
    };
    return legacyFromRaw({
      vct4: readKey("vct4"),
      vctActiveChallenges: readKey("vctActiveChallenges"),
      vctArchives: readKey("vctArchives"),
      vct2: readKey("vct2"),
    });
  }

  async function run(uid) {
    const VCT = root.VCT || {};
    const { fx, db } = VCT;
    if (!fx || !db) {
      throw new Error("VCT: Firestore SDK is not available for migration");
    }
    const guardRef = fx.doc(db, "users", uid, "meta", "migration");

    const existing = await fx.getDoc(guardRef);
    if (existing.exists()) return { migrated: false, reason: "already-migrated", challengeCount: 0, matchCount: 0 };

    const state = readLegacyState();
    const counts = countState(state);
    if (counts.challengeCount === 0) {
      await fx.setDoc(guardRef, {
        completedAt: fx.serverTimestamp(),
        sourceKeys: [], challengeCount: 0, matchCount: 0, backupDownloaded: false,
      });
      return { migrated: false, reason: "nothing-to-migrate", ...counts };
    }

    // Hand the user a file copy before anything moves.
    let backupDownloaded = false;
    try {
      const exportFn = (typeof root.exportBackupJson === "function" ? root.exportBackupJson : null)
        || (typeof exportBackupJson === "function" ? exportBackupJson : null);
      if (typeof exportFn === "function") {
        exportFn();
        backupDownloaded = true;
      }
    } catch (err) {
      console.warn("VCT: pre-migration backup failed", err);
    }

    const buildSnap = root.buildSnapshot || (root.VCTSnapshotModel && root.VCTSnapshotModel.buildSnapshot);
    if (typeof buildSnap !== "function") {
      throw new Error("VCT: buildSnapshot is not available for migration");
    }
    const snapshot = buildSnap(state);
    const writes = [];
    for (const [id, doc] of Object.entries(snapshot.challenges)) {
      writes.push({ ref: fx.doc(db, "users", uid, "challenges", id), doc });
    }
    for (const [key, doc] of Object.entries(snapshot.matches)) {
      const [challengeId, matchId] = key.split("/");
      writes.push({
        ref: fx.doc(db, "users", uid, "challenges", challengeId, "matches", matchId),
        doc,
      });
    }

    const chunkFn = root.chunk || (root.VCTSnapshotDiff && root.VCTSnapshotDiff.chunk) || ((arr, sz) => {
      const out = [];
      for (let i = 0; i < arr.length; i += sz) out.push(arr.slice(i, i + sz));
      return out;
    });

    for (const part of chunkFn(writes, 500)) {
      const batch = fx.writeBatch(db);
      for (const w of part) {
        batch.set(w.ref, Object.assign({}, w.doc, { updatedAt: fx.serverTimestamp() }));
      }
      await batch.commit();
    }

    // Verify before recording success. A mismatch means the guard is never
    // written, so the next load retries rather than silently accepting loss.
    const written = await fx.getDocs(fx.collection(db, "users", uid, "challenges"));
    if (written.size !== counts.challengeCount) {
      throw new Error(
        `Migration verification failed: expected ${counts.challengeCount} challenges, found ${written.size}`
      );
    }

    await fx.setDoc(guardRef, {
      completedAt: fx.serverTimestamp(),
      sourceKeys: ["vct4", "vctActiveChallenges", "vctArchives"],
      challengeCount: counts.challengeCount,
      matchCount: counts.matchCount,
      backupDownloaded,
    });

    return { migrated: true, ...counts };
  }

  return { run, readLegacyState, legacyFromRaw, countState };
});
