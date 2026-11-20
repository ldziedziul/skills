// Shared fixture and DOM helpers for the kit tests. Not a test file itself:
// node --test only picks up *.test.js.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
// jsdom is resolved from the directory the test runs in, not from here
const jsdom = require(require.resolve("jsdom", { paths: [process.cwd()] }));
const { JSDOM, VirtualConsole } = jsdom;

const SKILLS = path.resolve(__dirname, "..", "..");

// Per-skill contract: the two decision keys and which published pill
// marks an already-dropped card.
const CASES = [
  {
    name: "give-pr-review",
    file: `${SKILLS}/give-pr-review/references/report-template.html`,
    agree: "agree", drop: "drop",
    droppedPill: '<span class="st skipped">skipped</span>',
    activePill: '<span class="st topost act">to post</span>',
    decisionLine: "MY DECISION:",
  },
  {
    name: "reply-to-pr-review",
    file: `${SKILLS}/reply-to-pr-review/references/report-template.html`,
    agree: "agree", drop: "drop",
    droppedPill: '<span class="st none dropped">dropped</span>',
    activePill: '<span class="st open">action needed</span>',
    decisionLine: "MY DECISION:",
  },
  {
    name: "multi-perspective-review",
    file: `${SKILLS}/multi-perspective-review/references/report-template.html`,
    agree: "agree", drop: "drop",
    droppedPill: '<span class="st dropped">dropped</span>',
    activePill: '<span class="st tofix act">to fix</span>',
    decisionLine: "MY DECISION:",
  },
];

// Fixture: the template's example card, cloned into three cards with
// distinct titles; the third one carries the published dropped pill.
function fixture(c) {
  const html = fs.readFileSync(c.file, "utf8");
  const m = html.match(/<article class="item">[\s\S]*?<\/article>/);
  assert.ok(m, "template has an example card");
  // comments hold example pills too, so strip them before swapping the pill
  const card = m[0].replace(/<!--[\s\S]*?-->/g, "");
  const withTitle = (t) => card.replace(/<h3>[\s\S]*?<\/h3>/, `<h3>${t}</h3>`);
  const pillRe = /<span class="st [^"]*">[^<]*<\/span>/;
  const one = withTitle("First card");
  const two = withTitle("Second card");
  const three = withTitle("Third card").replace(pillRe, c.droppedPill);
  return html.replace(m[0], one + "\n" + two + "\n" + three);
}

function load(c, storage) {
  // any script error fails the test instead of being swallowed by jsdom
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => { throw e; });
  const dom = new JSDOM(fixture(c), {
    virtualConsole: vc,
    runScripts: "dangerously",
    url: "https://example.test/report",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.Element.prototype.scrollIntoView = function () {}; // not in jsdom
      if (storage) for (const [k, v] of Object.entries(storage)) window.localStorage.setItem(k, v);
    },
  });
  return dom.window;
}

function dump(window) {
  const out = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    out[k] = window.localStorage.getItem(k);
  }
  return out;
}

const cards = (w) => Array.from(w.document.querySelectorAll("article.item"));
const cardByTitle = (w, t) => cards(w).find((a) => a.querySelector("h3").textContent.trim() === t);
const hidden = (el) => el.hidden || /(^|\s)(filtered-out|label-hidden|search-hidden|dropped-hidden)(\s|$)/.test(el.className);
const button = (card, key) => card.querySelector(`button[data-decision="${key}"]`);
const showDropped = (w) => w.document.getElementById("show-dropped");
const statusText = (w) => w.document.querySelector(".actionbar .status").textContent;
const click = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("click", { bubbles: true }));

// The copy button has no clipboard in jsdom, so the export lands in the
// fallback textarea - that is what the tests read.
function exportText(w) {
  const btn = w.document.querySelector(".actionbar .copyall");
  click(btn);
  return w.document.getElementById("fallback-text").value;
}

module.exports = { CASES, fixture, load, dump, cards, cardByTitle, hidden, button, showDropped, statusText, click, exportText };
