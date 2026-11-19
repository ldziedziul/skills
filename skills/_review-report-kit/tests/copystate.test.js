// Behaviour tests for the "waiting to be copied" markers: the to-copy chip on
// the card, the "Not copied yet" filter and the hover preview. Run from any
// scratch directory with jsdom installed:
//   node --test ~/.claude/skills/_review-report-kit/tests/*.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { CASES, load, cards, cardByTitle, hidden, button, click, exportText } = require("./helpers.js");

const chip = (card) => card.querySelector(".item-head .st.copychip");
const waiting = (card) => card.classList.contains("tocopy");
const pendingBtn = (w) => w.document.getElementById("filter-pending");
const note = (card) => card.querySelector(".note textarea");
const fire = (el, type) => el.dispatchEvent(new el.ownerDocument.defaultView.Event(type, { bubbles: true }));
const type = (ta, text) => { ta.value = text; fire(ta, "input"); };

for (const c of CASES) {
  test(`${c.name}: nothing is marked to copy until a card says something`, () => {
    const w = load(c);
    for (const card of cards(w)) {
      assert.ok(chip(card), "every card carries the chip element");
      assert.ok(!waiting(card), "but no card is marked yet");
    }
    assert.ok(pendingBtn(w).hidden, "the filter stays out of the way");
  });

  test(`${c.name}: a decision, a note or a draft edit marks the card to copy`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    click(button(first, c.agree));
    assert.ok(waiting(first), "a decision puts the card in the next batch");
    assert.ok(!waiting(cardByTitle(w, "Second card")), "others untouched");

    const second = cardByTitle(w, "Second card");
    type(note(second), "my two cents");
    assert.ok(waiting(second), "a note does too");

    const third = cardByTitle(w, "Third card");
    const draft = third.querySelector(".snippet.draft textarea.draftbox");
    type(draft, "my own wording");
    assert.ok(waiting(third), "an edited draft does too");

    assert.ok(!pendingBtn(w).hidden);
    assert.match(pendingBtn(w).textContent, /3/, "the filter counts them");
  });

  test(`${c.name}: copying clears the marks, and changing the card brings them back`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    type(note(first), "something to send");
    assert.ok(waiting(first));

    exportText(w);
    assert.ok(!waiting(first), "copied cards drop out of the next batch");
    assert.ok(pendingBtn(w).hidden, "nothing left to copy");
    assert.match(first.querySelector(".note .sentmark").textContent, /copied/);

    type(note(first), "something else");
    assert.ok(waiting(first), "editing it after the copy makes it new again");
    assert.equal(first.querySelector(".note .sentmark").textContent, "");
  });

  test(`${c.name}: a dropped card keeps its chip until the drop has been copied`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    click(button(first, c.drop));
    assert.ok(waiting(first), "Claude still has to hear about the drop");
    exportText(w);
    assert.ok(!waiting(first));
  });

  test(`${c.name}: "Not copied yet" shows exactly the next batch`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    const second = cardByTitle(w, "Second card");
    type(note(first), "send this one");
    fire(note(first), "focusout");

    click(pendingBtn(w));
    assert.equal(pendingBtn(w).getAttribute("aria-pressed"), "true");
    assert.ok(!hidden(first), "the card that will be copied stays");
    assert.ok(hidden(second), "the rest are filtered out");
    assert.match(w.document.getElementById("filter-line").textContent, /not copied yet/);

    exportText(w);
    assert.ok(hidden(first), "after copying, the batch is empty");
    assert.ok(!pendingBtn(w).hidden, "the toggle stays reachable so it can be turned off");
    click(pendingBtn(w));
    assert.ok(!hidden(first));
  });

  test(`${c.name}: hovering Copy new outlines the batch`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    type(note(first), "send this one");
    const copy = w.document.querySelector(".actionbar .copyall");
    fire(copy, "mouseenter");
    assert.ok(w.document.body.classList.contains("previewcopy"));
    fire(copy, "mouseleave");
    assert.ok(!w.document.body.classList.contains("previewcopy"));
  });
}
