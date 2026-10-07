const test = require('node:test');
const assert = require('node:assert/strict');

const cloud = require('../js/cloud/cloud-sync.js');

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

function createHarness() {
  const listeners = [];
  const getDocCalls = [];
  const getDocsCalls = [];
  const harness = {
    listeners,
    getDocCalls,
    getDocsCalls,
    setDoc: async () => {},
    getDoc: async () => ({ exists: () => false }),
    getDocs: async () => ({ docs: [] }),
    commit: async () => {},
  };
  const fx = {
    doc: (_db, ...parts) => parts.join('/'),
    collection: (_db, ...parts) => parts.join('/'),
    setDoc: (...args) => harness.setDoc(...args),
    getDoc: (...args) => {
      getDocCalls.push(args[0]);
      return harness.getDoc(...args);
    },
    getDocs: (...args) => {
      getDocsCalls.push(args[0]);
      return harness.getDocs(...args);
    },
    onSnapshot: (ref, callback) => {
      const listener = { ref, callback, unsubscribed: false };
      listeners.push(listener);
      return () => { listener.unsubscribed = true; };
    },
    writeBatch: () => ({
      set() {},
      update() {},
      delete() {},
      commit: () => harness.commit(),
    }),
    serverTimestamp: () => 'server-time',
  };

  const vct = { fx, db: {}, uid: null, auth: null };
  global.window = {
    VCT: vct,
    buildSnapshot: () => ({ challenges: { c1: {} }, matches: {} }),
    diffSnapshots: () => ({
      creates: [{ kind: 'challenge', key: 'c1', doc: { name: 'Challenge' } }],
      updates: [],
      deletes: [],
    }),
  };
  harness.vct = vct;
  return harness;
}

test('startup abandoned during profile write cannot fetch or attach listeners', async () => {
  const previousWindow = global.window;
  cloud.stop();
  const harness = createHarness();
  const profileStarted = deferred();
  const finishProfile = deferred();
  harness.setDoc = async (ref) => {
    if (ref === 'users/uid-a') {
      profileStarted.resolve();
      await finishProfile.promise;
    }
  };

  try {
    harness.vct.uid = 'uid-a';
    const oldStart = cloud.start('uid-a');
    await profileStarted.promise;

    harness.vct.uid = 'uid-b';
    await cloud.start('uid-b');
    finishProfile.resolve();
    await oldStart;

    assert.deepStrictEqual(harness.getDocCalls, ['users/uid-b/meta/tombstones']);
    assert.strictEqual(harness.listeners.length, 2);
    assert.ok(harness.listeners.every(({ ref }) => ref.includes('uid-b')));

    cloud.stop();
    assert.ok(harness.listeners.every(({ unsubscribed }) => unsubscribed));
  } finally {
    cloud.stop();
    global.window = previousWindow;
  }
});

test('startup abandoned during tombstone fetch cannot replace active state or listeners', async () => {
  const previousWindow = global.window;
  cloud.stop();
  const harness = createHarness();
  const tombstonesStarted = deferred();
  const finishTombstones = deferred();
  harness.getDoc = async (ref) => {
    if (ref === 'users/uid-a/meta/tombstones') {
      tombstonesStarted.resolve();
      await finishTombstones.promise;
      return { exists: () => true, data: () => ({ c_stale: true }) };
    }
    return { exists: () => false };
  };

  try {
    harness.vct.uid = 'uid-a';
    const oldStart = cloud.start('uid-a');
    await tombstonesStarted.promise;

    harness.vct.uid = 'uid-b';
    await cloud.start('uid-b');
    finishTombstones.resolve();
    await oldStart;

    assert.deepStrictEqual(cloud.tombstones, {});
    assert.strictEqual(harness.listeners.length, 2);
    assert.ok(harness.listeners.every(({ ref }) => ref.includes('uid-b')));

    cloud.stop();
    assert.ok(harness.listeners.every(({ unsubscribed }) => unsubscribed));
  } finally {
    cloud.stop();
    global.window = previousWindow;
  }
});

test('callbacks from a prior session cannot mutate current tombstones or fetch matches', async () => {
  const previousWindow = global.window;
  cloud.stop();
  const harness = createHarness();

  try {
    harness.vct.uid = 'uid-a';
    await cloud.start('uid-a');
    const oldListeners = harness.listeners.slice();

    harness.vct.uid = 'uid-b';
    await cloud.start('uid-b');
    oldListeners.find(({ ref }) => ref.includes('meta/tombstones')).callback({
      exists: () => true,
      data: () => ({ c_stale: true }),
    });
    await oldListeners.find(({ ref }) => ref.endsWith('/challenges')).callback({
      docs: [{ id: 'c_stale', data: () => ({ name: 'Stale' }) }],
    });

    assert.deepStrictEqual(cloud.tombstones, {});
    assert.deepStrictEqual(harness.getDocsCalls, []);
  } finally {
    cloud.stop();
    global.window = previousWindow;
  }
});

test('a push completing after a session switch cannot advance the new session baseline', async () => {
  const previousWindow = global.window;
  cloud.stop();
  const harness = createHarness();
  const commitStarted = deferred();
  const finishCommit = deferred();
  harness.commit = () => {
    commitStarted.resolve();
    return finishCommit.promise;
  };

  try {
    harness.vct.uid = 'uid-a';
    await cloud.start('uid-a');
    cloud._setHydrated(true);
    cloud._setLastSyncedSnapshot({ challenges: {}, matches: {} });

    const oldPush = cloud.pushChanges();
    await commitStarted.promise;

    harness.vct.uid = 'uid-b';
    await cloud.start('uid-b');
    assert.deepStrictEqual(cloud.lastSyncedSnapshot, { challenges: {}, matches: {} });

    finishCommit.resolve();
    await oldPush;
    assert.deepStrictEqual(cloud.lastSyncedSnapshot, { challenges: {}, matches: {} });
  } finally {
    cloud.stop();
    global.window = previousWindow;
  }
});
