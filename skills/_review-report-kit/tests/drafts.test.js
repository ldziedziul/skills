// Behaviour tests for the editable paste-ready drafts shared by the three
// review report templates. Run from any scratch directory:
//   npm init -y && npm install jsdom@24
//   node --test ~/.claude/skills/_review-report-kit/tests/*.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { CASES, load, dump, cards, cardByTitle, hidden, statusText, click, exportText } = require("./helpers.js");

const draftBox = (card) => card.querySelector(".snippet.draft textarea.draftbox");
const fire = (el, type) => el.dispatchEvent(new el.ownerDocument.defaultView.Event(type, { bubbles: true }));
const type = (ta, text) => { ta.value = text; fire(ta, "input"); };
const blur = (ta) => fire(ta, "focusout");
const search = (w, q) => {
  const input = w.document.getElementById("search-text");
  input.value = q;
  fire(input, "input");
};

for (const c of CASES) {
  test(`${c.name}: each draft block is an editable box seeded with Claude's text`, () => {
    const w = load(c);
    for (const card of cards(w)) {
      const ta = draftBox(card);
      assert.ok(ta, "draft block is a textarea");
      assert.ok(ta.value.trim().length, "seeded with the drafted text");
      assert.equal(card.querySelector(".snippet.draft pre"), null, "the read-only pre is gone");
      assert.ok(card.querySelector(".snippet.draft .copydraft"), "Copy button");
      const revert = card.querySelector(".snippet.draft .revertdraft");
      assert.ok(revert, "Revert button");
      assert.ok(revert.hidden, "Revert hidden while the draft is untouched");
      assert.ok(card.querySelector(".snippet.draft .editmark").hidden, "no edited marker yet");
    }
  });

  test(`${c.name}: an edit is marked, persists across a load, and Revert undoes it`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    const original = draftBox(first).value;
    type(draftBox(first), "my own wording");
    assert.ok(first.querySelector(".snippet.draft").classList.contains("edited"));
    assert.ok(!first.querySelector(".snippet.draft .editmark").hidden, "edited marker shown");
    assert.ok(!first.querySelector(".snippet.draft .revertdraft").hidden, "Revert offered");
    assert.ok(first.classList.contains("editeddraft"), "card marks itself as changed");

    const w2 = load(c, dump(w));
    const first2 = cardByTitle(w2, "First card");
    assert.equal(draftBox(first2).value, "my own wording", "edit survives a reload");
    assert.equal(draftBox(cardByTitle(w2, "Second card")).value, original, "other cards untouched");

    click(first2.querySelector(".snippet.draft .revertdraft"));
    assert.equal(draftBox(first2).value, original, "Revert restores Claude's text");
    assert.ok(first2.querySelector(".snippet.draft .revertdraft").hidden);
    const kept = Object.keys(dump(w2)).filter((k) => /draft-/.test(k));
    assert.deepEqual(kept, [], "the stored edit is cleared, not left shadowing the draft");
  });

  test(`${c.name}: an edit alone counts the card and is copied back as the user's wording`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    const original = draftBox(first).value.trim();
    type(draftBox(first), "post exactly this instead");
    assert.match(statusText(w), /1 of 3/, "an edit counts like a decision");

    const text = exportText(w);
    assert.match(text, /## First card/);
    assert.match(text, /\(EDITED BY ME/, "the edited draft is flagged as the user's");
    assert.ok(text.includes("post exactly this instead"), "carries the edited wording");
    assert.ok(!text.includes(original), "Claude's original draft is not re-sent");
  });

  test(`${c.name}: an untouched draft exports unflagged`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    const note = first.querySelector(".note textarea");
    type(note, "just a note");
    const text = exportText(w);
    assert.ok(text.includes(draftBox(first).value.trim()), "the draft is quoted as written");
    assert.ok(!/\(EDITED BY ME/.test(text), "no edit flag when nothing was edited");
  });

  test(`${c.name}: the word filter and "without my comment" see the edited draft`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    type(draftBox(first), "a zanzibar rewrite");
    blur(draftBox(first));

    click(w.document.getElementById("filter-nonote"));
    assert.ok(hidden(first), "an edited card is no longer 'without my comment'");
    click(w.document.getElementById("filter-nonote"));

    search(w, "zanzibar");
    assert.ok(!hidden(first), "word typed into the draft is searchable");
    assert.ok(hidden(cardByTitle(w, "Second card")), "other cards filtered out");
  });

  test(`${c.name}: a rewritten draft wins over an edit made against the old one`, () => {
    const w = load(c);
    const first = cardByTitle(w, "First card");
    const original = draftBox(first).value;
    type(draftBox(first), "my older wording");
    const store = dump(w);
    const key = Object.keys(store).find((k) => /draft-/.test(k));
    assert.ok(key, "the edit is stored under a draft key");
    store[key] = JSON.stringify({ base: "a draft Claude has since replaced", text: "my older wording" });

    const w2 = load(c, store);
    const first2 = cardByTitle(w2, "First card");
    assert.equal(draftBox(first2).value, original, "the newer draft is shown");
    const notice = first2.querySelector(".snippet.draft .staleedit");
    assert.ok(notice, "the stale edit is announced, not silently dropped");
    const old = first2.querySelector(".snippet.draft .staletext");
    assert.ok(old.hidden, "kept out of the way until asked for");
    click(notice.querySelector("button"));
    assert.ok(!old.hidden);
    assert.match(old.textContent, /my older wording/);
  });
}
