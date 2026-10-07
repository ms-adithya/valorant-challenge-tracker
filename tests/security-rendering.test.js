const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { escapeHtml, escapeJsSingleQuoted } = require('../js/dom-utils.js');

const elements = new Map();
global.escapeHtml = escapeHtml;
global.escapeJsSingleQuoted = escapeJsSingleQuoted;
global.$ = (id) => {
  if (!elements.has(id)) {
    elements.set(id, {
      innerHTML: '',
      dataset: {},
      addEventListener() {},
      querySelectorAll() { return []; },
    });
  }
  return elements.get(id);
};
global.document = {
  addEventListener() {},
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
  assert.match(html, /onclick="[^"]*&amp;apos;\);alert\(1\);\/\/[^"]*"/);
  assert.doesNotMatch(html, /onclick="[^"]*&apos;/);
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