// Pure diff of two snapshots into a Firestore write set.
// No Firebase imports: this file must stay testable in plain Node.
(function (root, factory) {
  const api = factory();
  root.VCTSnapshotDiff = api;
  Object.assign(root, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  // null and undefined are the same absence here; v9.6 relies on optional
  // fields staying null rather than churning into 0.
  function sameValue(a, b) {
    if (a === null || a === undefined) return b === null || b === undefined;
    if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) return true;
    return a === b;
  }

  function sameDoc(a, b) {
    if (!a || !b) return a === b;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!sameValue(a[key], b[key])) return false;
    }
    return true;
  }

  function scan(kind, before, after, out) {
    for (const key of Object.keys(after)) {
      if (!(key in before)) out.creates.push({ kind, key, doc: after[key] });
      else if (!sameDoc(before[key], after[key])) {
        out.updates.push({ kind, key, doc: after[key] });
      }
    }
    for (const key of Object.keys(before)) {
      if (!(key in after)) out.deletes.push({ kind, key });
    }
  }

  function diffSnapshots(prev, next) {
    const out = { creates: [], updates: [], deletes: [] };
    const p = prev || {};
    const n = next || {};
    scan("challenge", p.challenges || {}, n.challenges || {}, out);
    // Firestore does not cascade-delete subcollections, so orphaned matches
    // must be deleted explicitly. Dropping a challenge drops its matches from
    // the snapshot, which lands them here automatically.
    scan("match", p.matches || {}, n.matches || {}, out);
    return out;
  }

  function chunk(items, size) {
    if (!Array.isArray(items)) return [];
    const sz = (!size || size <= 0) ? 500 : size;
    const out = [];
    for (let i = 0; i < items.length; i += sz) out.push(items.slice(i, i + sz));
    return out;
  }

  return { diffSnapshots, chunk, sameDoc };
});
