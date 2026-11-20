// Behaviour tests for the one-click decision buttons shared by the three
// review report templates (give-pr-review, reply-to-pr-review, multi-perspective-review).
// Run from any scratch directory:
//   npm init -y && npm install jsdom@24
//   node --test ~/.claude/skills/_review-report-kit/tests/*.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { CASES, load, dump, cards, cardByTitle, hidden, button, showDropped, statusText, click, exportText } = require("./helpers.js");

for (const c of CASES) {
  test(`${c.name}: every card has decision buttons and none is decided`, () => {
    const w = load(c);
    for (const card of cards(w)) {
      assert.ok(button(card, c.agree), "agree button");
      assert.ok(button(card, c.drop), "drop button");
      for (const b of card.querySelectorAll("button[data-decision]")) {
        assert.equal(b.getAttribute("aria-pressed"), "false");
      }
    }
  });

  test(`${c.name}: a published dropped pill hides the card by default; the toggle shows it`, () => {
    const w = load(c);
    assert.ok(!hidden(cardByTitle(w, "First card")));
    assert.ok(hidden(cardByTitle(w, "Third card")), "published-dropped card hidden");
    const t = showDropped(w);
    assert.ok(t, "#show-dropped toggle exists");
    assert.match(t.textContent, /1/, "toggle shows the dropped count");
    assert.equal(t.getAttribute("aria-pressed"), "false");
    click(t);
    assert.ok(!hidden(cardByTitle(w, "Third card")), "shown after toggle");
    assert.equal(t.getAttribute("aria-pressed"), "true");
  });

  test(`${c.name}: one click drops a card in place, counts it, hides it on the next load, and is reversible`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    click(button(first, c.drop));
    assert.equal(button(first, c.drop).getAttribute("aria-pressed"), "true");
    // the drop is seen where it happened: still on the page, marked, collapsed, with a toast
    assert.ok(!hidden(first), "dropped card stays visible in this page view");
    assert.ok(first.classList.contains("dropped"), "card carries the dropped class");
    assert.ok(first.classList.contains("collapsed"), "dropped card collapses");
    const chip = first.querySelector(".item-head .st.dropchip");
    assert.ok(chip && /dropped/.test(chip.textContent), "dropped chip in the header");
    const toast = w.document.querySelector(".toast");
    assert.ok(toast && !toast.hidden, "toast shown");
    assert.match(toast.textContent, /Dropped: First card/);
    assert.match(showDropped(w).textContent, /2/, "toggle counts local + published drops");
    assert.match(statusText(w), /1 of 3/, "status counts the decision as a comment");

    // persistence: a fresh page load with the same storage keeps the drop
    const w2 = load(c, dump(w));
    const first2 = cardByTitle(w2, "First card");
    assert.equal(button(first2, c.drop).getAttribute("aria-pressed"), "true");
    assert.ok(hidden(first2));

    // reversible: show dropped, click drop again -> undecided and visible
    click(showDropped(w2));
    click(button(first2, c.drop));
    assert.equal(button(first2, c.drop).getAttribute("aria-pressed"), "false");
    click(showDropped(w2));
    assert.ok(!hidden(first2));
    assert.match(showDropped(w2).textContent, /1/);
  });

  test(`${c.name}: the toast's Undo reverses a drop`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    click(button(first, c.drop));
    click(w.document.querySelector(".toast button"));
    assert.equal(button(first, c.drop).getAttribute("aria-pressed"), "false");
    assert.ok(!first.classList.contains("dropped"));
    assert.ok(!hidden(first));
    assert.ok(w.document.querySelector(".toast").hidden, "toast closed");
    assert.match(showDropped(w).textContent, /1/, "only the published drop remains");
  });

  test(`${c.name}: a published dropped pill marks the card dropped without a second chip`, () => {
    const w = load(c);
    const third = cardByTitle(w, "Third card");
    assert.ok(third.classList.contains("dropped"));
    assert.equal(third.querySelectorAll(".item-head .st.dropchip").length, 0, "no injected chip next to the pill");
  });

  test(`${c.name}: agree keeps the card visible and switches from drop`, () => {
    const w = load(c);
    const second = cardByTitle(w, "Second card");
    click(button(second, c.drop));
    click(button(second, c.agree));
    assert.equal(button(second, c.agree).getAttribute("aria-pressed"), "true");
    assert.equal(button(second, c.drop).getAttribute("aria-pressed"), "false");
    assert.ok(!hidden(second));
  });

  test(`${c.name}: agree collapses the card in place, marks it agreed, keeps it visible, and is reversible`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    assert.ok(!first.classList.contains("collapsed"), "action card starts expanded");
    click(button(first, c.agree));
    assert.ok(!hidden(first), "agreed card stays visible");
    assert.ok(first.classList.contains("collapsed"), "agreed card collapses");
    assert.ok(first.classList.contains("agreed"), "card carries the agreed class");
    assert.ok(!first.classList.contains("dropped"));
    const chip = first.querySelector(".item-head .st.agreechip");
    assert.ok(chip && /agreed/.test(chip.textContent), "agreed chip in the header");
    assert.equal(first.querySelectorAll(".item-head .st.agreechip").length, 1, "one chip per card");
    assert.ok(!showDropped(w).textContent.match(/2/), "agree does not count as dropped");

    // persistence: a fresh page load keeps the mark and the collapsed state
    const w2 = load(c, dump(w));
    const first2 = cardByTitle(w2, "First card");
    assert.equal(button(first2, c.agree).getAttribute("aria-pressed"), "true");
    assert.ok(first2.classList.contains("agreed"));
    assert.ok(first2.classList.contains("collapsed"));
    assert.ok(!hidden(first2));

    // reversible: clicking Agree again clears the mark and re-opens the card
    click(button(first2, c.agree));
    assert.equal(button(first2, c.agree).getAttribute("aria-pressed"), "false");
    assert.ok(!first2.classList.contains("agreed"));
    assert.ok(!first2.classList.contains("collapsed"), "un-agreed card re-opens");
  });

  test(`${c.name}: switching drop to agree swaps the marks`, () => {
    const w = load(c);
    const second = cardByTitle(w, "Second card");
    click(button(second, c.drop));
    assert.ok(second.classList.contains("dropped"));
    click(button(second, c.agree));
    assert.ok(second.classList.contains("agreed"));
    assert.ok(!second.classList.contains("dropped"));
    assert.ok(second.classList.contains("collapsed"), "stays collapsed across the switch");
    click(button(second, c.drop));
    assert.ok(second.classList.contains("dropped"));
    assert.ok(!second.classList.contains("agreed"));
  });

  test(`${c.name}: export carries the decision and the free text; copied tracking follows the decision`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    const second = cardByTitle(w, "Second card");
    click(button(first, c.drop));
    click(button(second, c.agree));
    const ta = second.querySelector(".note textarea");
    ta.value = "but rename the helper";
    ta.dispatchEvent(new w.Event("input", { bubbles: true }));

    const text = exportText(w);
    assert.match(text, new RegExp(`## First card[\\s\\S]*?${c.decisionLine} ${c.drop}`));
    assert.match(text, new RegExp(`## Second card[\\s\\S]*?${c.decisionLine} ${c.agree}`));
    assert.match(text, /but rename the helper/);
    assert.doesNotMatch(text, /## Third card/, "undecided card not exported");
    assert.match(statusText(w), /all copied/);

    // changing the decision makes the card new again
    click(button(second, c.drop));
    assert.doesNotMatch(statusText(w), /all copied/);
  });


  test(`${c.name}: two-step clear removes decisions and notes`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    click(button(first, c.drop));
    const clear = Array.from(w.document.querySelectorAll(".actionbar button")).find((b) => /^Clear/.test(b.textContent));
    click(clear);
    click(clear);
    assert.equal(button(first, c.drop).getAttribute("aria-pressed"), "false");
    assert.ok(!hidden(first));
    assert.match(statusText(w), /No (comments|decisions) yet/);
    assert.ok(!Object.keys(dump(w)).some((k) => /decision-/.test(k)), "no decision keys left");
  });

  test(`${c.name}: a decided card counts as commented for the without-my-comment filter`, () => {
    const w = load(c);
    const noNote = w.document.getElementById("filter-nonote");
    assert.ok(noNote, "every template has the without-my-comment toggle");
    const second = cardByTitle(w, "Second card");
    click(button(second, c.agree));
    click(noNote);
    assert.ok(hidden(second), "decided card excluded");
    assert.ok(!hidden(cardByTitle(w, "First card")));
  });
}

for (const c of CASES) {
  const recordScrolls = (w) => {
    const scrolled = [];
    w.Element.prototype.scrollIntoView = function () { scrolled.push(this.querySelector("h3").textContent.trim()); };
    return scrolled;
  };

  test(`${c.name}: agree or drop scrolls to the next expanded card`, () => {
    for (const key of [c.agree, c.drop]) {
      const w = load(c);
      const scrolled = recordScrolls(w);
      click(button(cardByTitle(w, "First card"), key));
      assert.deepEqual(scrolled, ["Second card"], `${key} moves on to the next open card`);
    }
  });

  test(`${c.name}: no scroll when no expanded card follows, or a decision is taken back`, () => {
    const w = load(c);
    const scrolled = recordScrolls(w);
    click(button(cardByTitle(w, "Second card"), c.agree));
    assert.deepEqual(scrolled, [], "the third card is dropped and hidden, so nothing follows");
    click(button(cardByTitle(w, "Second card"), c.agree));
    assert.deepEqual(scrolled, [], "taking the decision back reopens the card in place");
  });

  test(`${c.name}: the scroll skips cards hidden by a filter`, () => {
    const w = load(c);
    const scrolled = recordScrolls(w);
    const input = w.document.getElementById("search-text");
    input.value = '"first card"';
    input.dispatchEvent(new w.Event("input", { bubbles: true }));
    click(button(cardByTitle(w, "First card"), c.agree));
    assert.deepEqual(scrolled, [], "the second card is filtered out");
  });
}
