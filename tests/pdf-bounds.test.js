const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createReportContext(challenge, options = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "challenge-report.js"), "utf8");
  const notices = [];
  const downloads = [];

  const mockDoc = {
    pages: 1,
    internal: {
      pageSize: { getWidth: () => 595, getHeight: () => 842 },
      getNumberOfPages() { return mockDoc.pages; }
    },
    setFontSize() {},
    setFont() {},
    setTextColor() {},
    setDrawColor() {},
    setLineWidth() {},
    roundedRect() {},
    text() {},
    line() {},
    addPage() { mockDoc.pages++; },
    setPage() {},
    getTextWidth() { return 10; },
    autoTable(tableOptions) {
      if (options.simulateExcessivePages && tableOptions.didDrawPage) {
        while (mockDoc.pages <= (options.pageTarget || 60)) {
          tableOptions.didDrawPage();
          mockDoc.pages++;
        }
      }
    },
    output() { return "mock-pdf-blob-content"; },
    lastAutoTable: { finalY: 100 }
  };

  const context = {
    window: {
      jspdf: {
        jsPDF: function() { return mockDoc; }
      }
    },
    document: {
      createElement: () => ({ remove() {}, click() {} }),
      body: { appendChild() {} }
    },
    URL: {
      createObjectURL: (blob) => "blob:mock-url",
      revokeObjectURL: () => {}
    },
    Blob: class {
      constructor(parts, opts) {
        this.parts = parts;
        this.opts = opts;
      }
    },
    showAppNotice: (message, title) => notices.push({ message, title }),
    console: { error() {} },
    findChallengeById: () => challenge,
    challengeComplete: () => true,
    challengeProgressText: () => "Completed",
    setTimeout: (fn) => fn(),
    optionalNumber: (v) => (v === undefined || v === null ? null : Number(v)),
    reportValue: (v, suffix = "") => (v === undefined || v === null ? "—" : `${v}${suffix}`)
  };

  // Intercept downloadBlob before challenge-report declares it
  vm.runInNewContext(source, context);

  // Re-hook downloadBlob in the context to capture downloads
  const originalDownload = context.downloadBlob;
  context.downloadBlob = (filename, blob) => {
    downloads.push({ filename, blob });
    if (typeof originalDownload === "function") {
      try { originalDownload(filename, blob); } catch {}
    }
  };

  return { context, notices, downloads, mockDoc };
}

test("PDF report generation: rejects challenge exceeding match limit upfront", () => {
  const challenge = {
    name: "Huge Match Challenge",
    startRank: "Bronze 1",
    matches: Array.from({ length: 2001 }, (_, i) => ({
      no: i + 1, result: "Win", agent: "Jett", map: "Ascent", myScore: 13, enemyScore: 5
    }))
  };

  const { context, notices, downloads } = createReportContext(challenge);
  context.window.downloadChallengeReportPDF("huge-id");

  assert.strictEqual(downloads.length, 0);
  assert.strictEqual(notices.length, 1);
  assert.match(notices[0].message, /too large to generate a PDF report/i);
  assert.strictEqual(notices[0].title, "Report too large");
});

test("PDF report generation: halts during generation when page limit is exceeded", () => {
  const challenge = {
    name: "Page Overflow Challenge",
    startRank: "Silver 2",
    matches: Array.from({ length: 100 }, (_, i) => ({
      no: i + 1, result: "Win", agent: "Omen", map: "Haven", myScore: 13, enemyScore: 10
    }))
  };

  const { context, notices, downloads } = createReportContext(challenge, {
    simulateExcessivePages: true,
    pageTarget: 55
  });

  context.window.downloadChallengeReportPDF("overflow-id");

  assert.strictEqual(downloads.length, 0);
  assert.strictEqual(notices.length, 1);
  assert.match(notices[0].message, /too large to generate a PDF report/i);
  assert.strictEqual(notices[0].title, "Report too large");
});

test("PDF text sanitizer: bounds display length and normalizes unicode/emojis safely", () => {
  const { context } = createReportContext({ name: "Simple", matches: [] });

  // Access pdfText in context
  const source = `
    const longName = "A".repeat(200);
    const sanitizedLong = pdfText(longName);
    const emojiName = "🎯 Road to Radiant 🔥";
    const sanitizedEmoji = pdfText(emojiName);
    const unicodeMath = "Rank ≥ Immortal — Win → Next";
    const sanitizedUnicode = pdfText(unicodeMath);
    ({ sanitizedLong, sanitizedEmoji, sanitizedUnicode })
  `;

  const results = vm.runInContext(source, context);

  // Must not exceed 120 characters and must terminate with ASCII ellipsis
  assert.strictEqual(results.sanitizedLong.length, 120);
  assert.ok(results.sanitizedLong.endsWith("..."));
  assert.doesNotMatch(results.sanitizedLong, /…/); // No unicode ellipsis

  // Emojis stripped, letters preserved
  assert.strictEqual(results.sanitizedEmoji, "Road to Radiant");

  // Symbols substituted with WinAnsi-safe ASCII equivalents
  assert.strictEqual(results.sanitizedUnicode, "Rank >= Immortal - Win -> Next");
});

test("PDF report generation: succeeds and produces downloadable file within normal budget", () => {
  const challenge = {
    name: "Valid Completed Challenge",
    startRank: "Gold 1",
    matches: [
      { no: 1, result: "Win", agent: "Jett", map: "Ascent", myScore: 13, enemyScore: 7, kills: 22, deaths: 12, assists: 4, acs: 260, adr: 165, ddDelta: 45, hs: 25, kast: 75, rrChange: 21 },
      { no: 2, result: "Loss", agent: "Reyna", map: "Bind", myScore: 9, enemyScore: 13, kills: 18, deaths: 15, assists: 2, acs: 210, adr: 140, ddDelta: -10, hs: 20, kast: 65, rrChange: -18 }
    ]
  };

  const { context, notices, downloads } = createReportContext(challenge);
  context.window.downloadChallengeReportPDF("valid-id");

  assert.strictEqual(notices.length, 0);
  assert.strictEqual(downloads.length, 1);
  assert.match(downloads[0].filename, /valid-completed-challenge-report\.pdf$/i);
});
