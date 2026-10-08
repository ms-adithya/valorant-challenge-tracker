const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { escapeHtml } = require('../js/dom-utils.js');

const elements = new Map();
let archiveActionClickHandler;
global.escapeHtml = escapeHtml;
global.$ = (id) => {
  if (!elements.has(id)) {
    elements.set(id, {
      innerHTML: '',
      dataset: {},
      classList: { toggle() {} },
      addEventListener() {},
      querySelectorAll() { return []; },
    });
  }
  return elements.get(id);
};
global.document = {
  addEventListener(type, handler) {
    if (type === 'click' && !archiveActionClickHandler) archiveActionClickHandler = handler;
  },
  querySelectorAll() { return []; },
};

const hostile = '<img src=x onerror=alert(1)> </div> " \' ` onclick= javascript: &amp;';

test('challenge archive renders attacker-controlled values as inert text', () => {
  global.activeChallenges = [{
    id: '&apos;);alert(1);//',
    name: hostile,
    matches: [],
    startRank: hostile,
    targetRank: hostile,
  }];
  global.archives = [];
  global.data = null;
  global.challengeProgress = () => ({ isComplete: false });
  global.challengeProgressText = () => hostile;

  const { renderArchive } = require('../js/challenge-archive.js');
  renderArchive();

  const html = global.$('challengeArchive').innerHTML;
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img[^>]*onerror/i);
  assert.doesNotMatch(html, /<[a-z][^>]*\son(click|change|input|load)\s*=/i);
  assert.match(html, /data-archive-action="open-active"/i);
  assert.match(html, /data-archive-id="[^"]*alert\(1\);\/\/"/i);
});

test('analytics labels are escaped in agent, distribution, and win-bar output', () => {
  global.analyticsMatches = () => [{
    agent: hostile,
    map: hostile,
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
  renderTopAgents();
  renderDist('agent', 'agentDistribution');
  renderWinBars('agent', 'agentWinBars');

  for (const id of ['topAgentsTable', 'agentDistribution', 'agentWinBars']) {
    const html = global.$(id).innerHTML;
    assert.doesNotMatch(html, /<img[^>]*onerror/i);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  }
  const titleTag = global.$('agentWinBars').innerHTML
    .match(/<span class="hbar-name"[^>]*>/)?.[0];
  assert.ok(titleTag);
  assert.match(titleTag, /title="[^"]*&quot;[^&#]*&#39;[^\"]*">/);
});

test('top-map renderer escapes attacker-controlled map names', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const script = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi)]
    .map((match) => match[1])
    .find((content) => content.includes('window.renderTopMaps=render;'));
  assert.ok(script, 'top-map renderer script should be present');

  const host = { innerHTML: '' };
  const context = {
    document: {
      addEventListener() {},
      getElementById: (id) => id === 'top-maps-list' ? host : null,
    },
    window: {},
    analyticsMatches: () => [{ map: hostile, result: 'Win' }],
    escapeHtml,
  };
  vm.runInNewContext(script, context);
  context.window.renderTopMaps();

  assert.match(host.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(host.innerHTML, /<img[^>]*onerror/i);
});

test('import preview escapes untrusted fields before commit', () => {
  const { renderImportPreview } = require('../js/import-preview.js');
  const invalidRow = {
    errors: [hostile],
    rankStatusAdjusted: hostile,
    assignment: { row: 1, requested: 1, assigned: 2, reason: hostile },
    match: {
      agent: hostile,
      map: hostile,
      result: hostile,
      myScore: 13,
      enemyScore: 4,
      rankAfter: hostile,
      rrChange: 12,
    },
  };

  renderImportPreview([invalidRow]);

  const html = global.$('importMatchesPreview').innerHTML;
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img[^>]*onerror/i);
  assert.doesNotMatch(html, /<[^>]+\sonclick\s*=/i);
  assert.match(html, /<span class="result-pill ">No result<\/span>/);
});

test('JSON match import rejects oversized files before reading them', async () => {
  const maxFileBytes = 2 * 1024 * 1024;
  const parser = fs.readFileSync(path.join(__dirname, '..', 'js', 'import-parse.js'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'import-commit.js'), 'utf8');
  const notices = [];
  const errors = [];
  let readCalled = false;
  const context = {
    $: () => null,
    data: { matches: [] },
    document: { addEventListener() {} },
    showAppNotice: (message) => notices.push(message),
    console: { error(error) { errors.push(error); } },
    TextEncoder,
  };
  vm.runInNewContext(parser, context);
  vm.runInNewContext(source, context);

  await context.readMatchImportFile({
    name: 'matches.json',
    type: 'application/json',
    size: maxFileBytes + 1,
    async text() {
      readCalled = true;
      throw new Error('oversized file should be rejected before reading');
    },
  });

  assert.strictEqual(readCalled, false);
  assert.match(errors[0].message, /too large/i);
  assert.ok(notices.length > 0);
});

test('JSON match import enforces row and field limits before preview', async () => {
  const parser = fs.readFileSync(path.join(__dirname, '..', 'js', 'import-parse.js'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'import-commit.js'), 'utf8');
  const notices = [];
  const errors = [];
  const previews = [];
  const context = {
    $: () => null,
    data: { matches: [] },
    document: { addEventListener() {} },
    showAppNotice: (message) => notices.push(message),
    buildImportPreview: (matches) => previews.push(matches),
    console: { error(error) { errors.push(error); } },
    TextEncoder,
  };
  vm.runInNewContext(parser, context);
  vm.runInNewContext(source, context);
  const json = JSON.stringify({ matches: Array.from({ length: 5001 }, () => ({})) });

  await context.readMatchImportFile({
    name: 'matches.json',
    type: 'application/json',
    size: Buffer.byteLength(json),
    async text() { return json; },
  });

  const longFieldJson = JSON.stringify({ matches: [{ agent: 'x'.repeat(4001) }] });
  await context.readMatchImportFile({
    name: 'matches.json',
    type: 'application/json',
    size: Buffer.byteLength(longFieldJson),
    async text() { return longFieldJson; },
  });

  assert.deepStrictEqual(previews, []);
  assert.match(errors[0].message, /row count exceeds/i);
  assert.match(errors[1].message, /field exceeds/i);
});

test('archive actions use data attributes instead of inline JavaScript', () => {
  global.activeChallenges = [{ id: '&apos;);alert(1);//', name: 'Test challenge', matches: [] }];
  global.archives = [];
  global.data = null;
  global.challengeProgress = () => ({ isComplete: false });
  global.challengeProgressText = () => '0/0 matches';

  const { renderArchive } = require('../js/challenge-archive.js');
  renderArchive();

  const html = global.$('challengeArchive').innerHTML;
  assert.doesNotMatch(html, /on(click|change|input|load)\s*=/i);
  assert.match(html, /data-archive-action=/i);
  assert.match(html, /data-archive-id=/i);
});

test('delegated delete actions pass decoded IDs from all archive views', () => {
  const hostileId = '&apos;);alert(1);//';
  const archivedChallenge = { id: hostileId, name: 'Archived challenge', matches: [], target: 10 };
  const calls = [];
  global.deleteActiveById = (id) => calls.push(['delete-active', id]);
  global.deleteArchivedChallenge = (id) => calls.push(['delete-archived', id]);
  global.activeChallenges = [{ ...archivedChallenge, name: 'Active challenge' }];
  global.archives = [];
  global.data = null;
  global.challengeProgress = () => ({ isComplete: false });
  global.challengeProgressText = () => '0/10 matches';

  const { renderArchive } = require('../js/challenge-archive.js');
  renderArchive();
  const activeHtml = global.$('challengeArchive').innerHTML;
  assert.ok(activeHtml.includes(`data-archive-action="delete-active" data-archive-id="&amp;apos;);alert(1);//"`));

  const navigation = fs.readFileSync(path.join(__dirname, '..', 'js', 'navigation.js'), 'utf8');
  const navigationContext = { $, document: global.document, escapeHtml, archives: [archivedChallenge] };
  vm.runInNewContext(navigation, navigationContext);
  navigationContext.renderArchiveBrowser();
  const browserHtml = global.$('archiveBrowserList').innerHTML;
  assert.ok(browserHtml.includes(`data-archive-action="delete-archived" data-archive-id="&amp;apos;);alert(1);//"`));

  const setupRestore = fs.readFileSync(path.join(__dirname, '..', 'js', 'setup-restore.js'), 'utf8');
  const setupContext = {
    $,
    escapeHtml,
    challengeProgressText: global.challengeProgressText,
    wireRestoreInput() {},
    data: null,
    activeChallenges: [],
    archives: [archivedChallenge],
  };
  vm.runInNewContext(setupRestore, setupContext);
  setupContext.renderSetupRestore();
  const setupHtml = global.$('setupArchiveList').innerHTML;
  assert.ok(setupHtml.includes(`data-archive-action="delete-archived" data-archive-id="&amp;apos;);alert(1);//"`));

  const dispatchDelete = (action) => archiveActionClickHandler({
    target: {
      closest(selector) {
        assert.equal(selector, '[data-archive-action]');
        return { dataset: { archiveAction: action, archiveId: hostileId } };
      },
    },
  });
  dispatchDelete('delete-active');
  dispatchDelete('delete-archived');
  dispatchDelete('delete-archived');

  assert.deepEqual(calls, [
    ['delete-active', hostileId],
    ['delete-archived', hostileId],
    ['delete-archived', hostileId],
  ]);
});