const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("PDF report generation respects page budget and limits text", async () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "challenge-report.js"), "utf8");
  
  const notices = [];
  let pdfResult = null;
  
  // Create a fake jsPDF implementation
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
    autoTable(options) {
      if (options.didDrawPage) {
        // Simulate drawing multiple pages until limit is exceeded
        while (mockDoc.pages <= 60) {
          options.didDrawPage();
          mockDoc.pages++;
        }
      }
    },
    output() { return "blob"; },
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
    URL: { createObjectURL() {}, revokeObjectURL() {} },
    Blob: class {},
    showAppNotice: (message, title) => notices.push({message, title}),
    console: { error() {} },
    downloadBlob: (filename, blob) => { pdfResult = filename; },
    findChallengeById: () => ({
      name: "Long ".repeat(50), // Oversized name
      startRank: "Bronze",
      matches: Array.from({length: 2000}, (_, i) => ({
        no: i + 1, result: "Win", agent: "Jett", map: "Ascent", myScore: 13, enemyScore: 0,
        kills: 20, deaths: 10, assists: 5
      }))
    }),
    challengeComplete: () => true,
    challengeProgressText: () => "Completed",
    setTimeout: (fn) => fn(),
    optionalNumber: (v) => v,
    reportValue: (v) => v
  };
  
  vm.runInNewContext(source, context);
  
  context.window.downloadChallengeReportPDF("mock-id");
  
  // It should have thrown because the pages exceeded 50
  assert.strictEqual(pdfResult, null);
  assert.strictEqual(notices.length, 1);
  assert.match(notices[0].message, /too large to generate a PDF report/i);
});
