const test = require('node:test');
const assert = require('node:assert');

const { escapeHtml, escapeJsSingleQuoted } = require('../js/dom-utils.js');

global.escapeHtml = escapeHtml;
global.escapeJsSingleQuoted = escapeJsSingleQuoted;
global.challengeProgress = () => ({ isComplete: false });
global.challengeProgressText = () => '2/3 matches';

global.$ = (id) => global.document.getElementById(id);

global.document = {
  getElementById(id) {
    if (!this._cache) this._cache = {};
    if (!this._cache[id]) {
      this._cache[id] = {
        innerHTML: '',
        dataset: {},
        querySelectorAll() { return []; },
      };
    }
    return this._cache[id];
  },
  querySelectorAll() { return []; },
  addEventListener() {},
};

function resetDom() {
  global.document._cache = {};
}

test('challenge archive rendering escapes attacker-controlled names and avoids inline JS', () => {
  resetDom();
  global.activeChallenges = [{
    id: 'chattack',
    name: '<img src=x onerror=alert(1)>',
    matches: [],
    startRank: 'Silver 1',
    targetRank: 'Gold 1',
  }];
  global.archives = [];
  global.data = null;

  const { renderArchive } = require('../js/challenge-archive.js');
  assert.strictEqual(typeof renderArchive, 'function');

  renderArchive();
  const host = global.document.getElementById('challengeArchive');
  assert.doesNotMatch(host.innerHTML, /<img[^>]*onerror/i);
  assert.match(host.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/i);
  assert.doesNotMatch(host.innerHTML, /onclick=/i);
});

test('analytics panel rendering escapes attacker-controlled agent and map strings', () => {
  resetDom();
  global.analyticsMatches = () => [{
    agent: '<img src=x onerror=alert(1)>',
    map: '<svg onload=alert(1)>',
    result: 'Win',
    kills: 10,
    deaths: 2,
    assists: 5,
    adr: 120,
    acs: 250,
    ddDelta: 18,
    hs: 50,
    no: 1,
  }];

  const { renderTopAgents, renderDist, renderWinBars } = require('../js/analytics-panels.js');
  assert.strictEqual(typeof renderTopAgents, 'function');
  assert.strictEqual(typeof renderDist, 'function');
  assert.strictEqual(typeof renderWinBars, 'function');

  const topAgentsHost = global.document.getElementById('topAgentsTable');
  renderTopAgents();
  assert.doesNotMatch(topAgentsHost.innerHTML, /<img[^>]*onerror/i);
  assert.match(topAgentsHost.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/i);

  const distHost = global.document.getElementById('agentDistribution');
  renderDist('agent', 'agentDistribution');
  assert.doesNotMatch(distHost.innerHTML, /<img[^>]*onerror/i);

  const barsHost = global.document.getElementById('agentWinBars');
  renderWinBars('agent', 'agentWinBars');
  assert.doesNotMatch(barsHost.innerHTML, /<img[^>]*onerror/i);
});

test('import parsing enforces a bounded file and column budget before expensive work', () => {
  const { parseDelimited, IMPORT_LIMITS } = require('../js/import-parse.js');

  const tooLarge = 'A,B\n1,2\n'.repeat(100000);
  assert.throws(() => parseDelimited(tooLarge, ','), /too large|limit/i);

  const tooManyCols = Array.from({ length: IMPORT_LIMITS.maxColumns + 1 }, (_, i) => `c${i}`).join(',');
  assert.throws(() => parseDelimited(`${tooManyCols}\n1,2\n`, ','), /column|limit/i);
});

test('cloud sync invalidates stale sessions before applying async snapshot results', () => {
  const cloud = require('../js/cloud/cloud-sync.js');
  const origWindow = global.window;
  const origData = global.data;
  const origActiveChallenges = global.activeChallenges;
  const origArchives = global.archives;

  try {
    const fakeDb = {};
    const callbacks = [];
    const fakeFx = {
      doc: (...args) => ({ path: args.join('/') }),
      collection: (...args) => ({ path: args.join('/') }),
      setDoc: async () => {},
      getDoc: async () => ({ exists: () => false }),
      onSnapshot: (ref, cb) => { callbacks.push(cb); return () => {}; },
      getDocs: async () => ({ docs: [] }),
      writeBatch: () => ({ set() {}, update() {}, delete() {}, commit: async () => {} }),
      serverTimestamp: () => 'server-time',
    };

    global.window = {
      VCT: {
        fx: fakeFx,
        db: fakeDb,
        uid: 'uid-1',
        auth: { currentUser: { uid: 'uid-1', displayName: 'User One', email: 'one@example.com' } },
      },
      activeChallenges: [],
      archives: [],
      data: { matches: [] },
      render: () => {},
      persist: () => true,
      showAppNotice: () => {},
      showToast: () => {},
    };
    global.data = global.window.data;
    global.activeChallenges = global.window.activeChallenges;
    global.archives = global.window.archives;

    cloud.start('uid-1');
    const firstGeneration = cloud._getSessionGeneration();
    cloud.start('uid-2');
    const secondGeneration = cloud._getSessionGeneration();
    assert.ok(secondGeneration > firstGeneration);
    assert.ok(cloud._isCurrentSession(secondGeneration));
    assert.ok(!cloud._isCurrentSession(firstGeneration));
  } finally {
    global.window = origWindow;
    global.data = origData;
    global.activeChallenges = origActiveChallenges;
    global.archives = origArchives;
  }
});
