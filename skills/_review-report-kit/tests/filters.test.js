// The filter model shared by the three templates: status tiles, the word
// filter with quoted phrases, label chips (lens chips in lukasz-self-review), and
// the without-my-comment toggle. Fixture: three cards, the third published
// as dropped (see decisions.test.js).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { CASES, load, cardByTitle, hidden, click } = require("./helpers.js");

const setSearch = (w, q) => {
  const input = w.document.getElementById("search-text");
  input.value = q;
  input.dispatchEvent(new w.Event("input", { bubbles: true }));
};
const filterLine = (w) => w.document.getElementById("filter-line");

for (const c of CASES) {
  test(`${c.name}: a tally tile filters to its pill and reports the count`, () => {
    const w = load(c);
    const activeSt = c.activePill.match(/class="st ([a-z]+)/)[1]; // first pill class of the active pill
    const tile = w.document.querySelector(`.tally li[data-st="${activeSt}"]`);
    assert.ok(tile, `tile for ${activeSt} exists in the fixture header`);
    click(tile);
    assert.equal(tile.getAttribute("aria-pressed"), "true");
    assert.ok(!hidden(cardByTitle(w, "First card")));
    assert.ok(!hidden(cardByTitle(w, "Second card")));
    assert.ok(hidden(cardByTitle(w, "Third card")), "dropped-pill card does not carry the active pill");
    assert.match(filterLine(w).textContent, /Showing 2 of 3 cards/);
    click(tile);
    assert.equal(tile.getAttribute("aria-pressed"), "false");
    assert.ok(filterLine(w).hidden, "no filter active, no filter line");
  });

  test(`${c.name}: the word filter needs every term, and a quoted phrase in sequence`, () => {
    const w = load(c);
    setSearch(w, "second");
    assert.ok(hidden(cardByTitle(w, "First card")));
    assert.ok(!hidden(cardByTitle(w, "Second card")));
    setSearch(w, '"second card"');
    assert.ok(!hidden(cardByTitle(w, "Second card")));
    setSearch(w, '"card second"');
    assert.ok(hidden(cardByTitle(w, "Second card")), "phrase order matters");
    setSearch(w, "");
    assert.ok(!hidden(cardByTitle(w, "First card")));
  });

  test(`${c.name}: label chips are built from the cards' tags with counts`, () => {
    const w = load(c);
    const tag = cardByTitle(w, "First card").querySelector(".item-head .tag");
    const text = tag.textContent.trim();
    const chip = Array.from(w.document.querySelectorAll("button.labelchip")).find((b) => b.textContent.trim().startsWith(text));
    assert.ok(chip, `a chip for tag "${text}"`);
    assert.match(chip.querySelector(".n").textContent, /3/, "three cards carry the tag");
  });
}

test("lukasz-self-review: a lens chip becomes a label chip in the Perspective group", () => {
  const c = CASES.find((x) => x.name === "lukasz-self-review");
  const w = load(c);
  const lens = cardByTitle(w, "First card").querySelector(".item-head .lens");
  assert.ok(lens, "fixture card has a lens chip");
  const group = Array.from(w.document.querySelectorAll(".labelgroup")).find((g) => g.querySelector(".gname").textContent === "Perspective");
  assert.ok(group, "a Perspective group under More filters");
  assert.ok(Array.from(group.querySelectorAll("button.labelchip")).some((b) => b.textContent.trim().startsWith(lens.textContent.trim())));
});

for (const name of ["give-pr-review", "lukasz-self-review"]) {
  test(`${name}: severity and certainty tags become chips in their own groups`, () => {
    const c = CASES.find((x) => x.name === name);
    const w = load(c);
    const groupOf = (gname) => Array.from(w.document.querySelectorAll(".labelgroup")).find((g) => g.querySelector(".gname").textContent === gname);
    for (const [cls, gname] of [["minor", "Severity"], ["likely", "Certainty"]]) {
      assert.ok(cardByTitle(w, "First card").querySelector(`.item-head .tag.${cls}`), `fixture card has a ${cls} tag`);
      const group = groupOf(gname);
      assert.ok(group, `a ${gname} group under More filters`);
      const chip = group.querySelector(`button.labelchip.${cls}`);
      assert.ok(chip, `a ${cls} chip in the ${gname} group`);
      assert.match(chip.querySelector(".n").textContent, /3/, "three cards carry the tag");
      assert.equal(chip.firstChild.textContent, cls, "the chip label is the bare value; the emoji or dots come from CSS");
    }
  });
}
