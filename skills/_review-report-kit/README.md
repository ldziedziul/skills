# Review report kit

The one source for the report pages that give-pr-review, reply-to-pr-review
and multi-perspective-review publish as Claude artifacts. It is not a skill (no SKILL.md);
the skills ship the generated `references/report-template.html` and their
SKILL.md files tell Claude to copy and fill that file at run time.

## Layout

- `core/base.css`, `core/report.js` - shared look and behaviour. `report.js`
  is the body of an IIFE and reads only the `CONFIG` object each skill defines.
- `skills/<name>/config.js` - the `KEY_PREFIX` and `EXPORT_HEADER` fill lines
  and the `CONFIG` object: pill vocabulary, decision labels, wording, export
  intro. Everything that differs between the skills and that the script reads.
- `skills/<name>/theme.css` - that skill's colours for status pills, severity
  tags, section chips and label chips.
- `skills/<name>/body.html` - that skill's markup with the `FILL:` instructions
  Claude follows, and two markers: `<!--STYLE-->` and `<!--SCRIPT-->`.
- `build.py` - concatenates the above into each skill's shipped template.
- `tests/` - jsdom harness over the three generated files.

## Page behaviour

What `core/report.js` implements for all three pages, and why. The wording
below is reply-to-pr-review's; the other two differ only in what their
`config.js` sets - pill names and the tiles they filter, decision labels
(`Agree - post as drafted`, `Agree - fix it`, `Agree - do it`), and whether
the export calls its entries comments or decisions.

- **Collapsible cards**: only action-needed cards start expanded; a
  manual toggle is remembered and wins. The default view is the user's
  queue, not an archive.
- **Status filter on the tally tiles**: each `li` carries `data-st` naming
  the pill class it filters (open / done / local / replied / none); clicking
  a tile shows only cards with that pill, several tiles = ANY of them. The
  **"Action needed only"** button is a preset that selects the `open` tile.
- **Label chips** built by the JS from each card's tags (not status pills -
  the tiles cover those), each with its card count. Tags named in the
  viewbar's `data-pinned` attribute (comma-separated, e.g. `quick win`)
  stay in the top row next to the action button; set it when a label is
  the user's working lens, delete the attribute otherwise. All other chips
  sit under a collapsed **More filters** disclosure, grouped by tag class
  (fix / docs / answer / decision / other), sorted by count. A card shows
  if it matches ANY selected label.
- **One-click decisions** on every card: `Agree - do it` / `Drop` toggle
  buttons above the note box, stored per browser apart from the free
  text. Agree means do what the card says (apply the suggested fix, post
  the paste-ready reply); Drop means leave it. Either decision collapses
  the card in place; an agreed card keeps its pill, gets an `agreed` chip
  and a green edge, and stays visible on every load. Clicking a pressed
  decision again clears it and re-opens the card. After either decision
  the page scrolls to the next card still open and shown, if any.
- **A dropped card stays visible where it was dropped** - dimmed, struck
  through, a `dropped` chip in its header, collapsed, with an Undo toast;
  from the next page load on, dropped cards (a local Drop, or a published
  `dropped` pill) hide behind a `Show dropped (N)` viewbar toggle
  (persisted). The tally is unchanged; it reflects published state.
- **"Without my comment"** button - only cards with no decision and an
  empty note box; re-evaluated when a note box loses focus, not per
  keystroke.
- **Word filter** in the top row (`/` focuses it): every term must appear
  somewhere on the card, any order; a `"quoted phrase"` must appear in
  sequence. No separate exact-phrase control.
- All four filters compose (a card must pass every one) and a **result
  line** appears under the bar only while a filter is active: "Showing N
  of M cards", the active filters, and a Clear filters link. Status, label
  and no-comment picks persist in localStorage.
- **Editable paste-ready replies**: each `snippet draft` block is a
  textarea with Copy and Revert and an `edited` marker once it differs
  from the drafted text. The edit is saved per browser against the draft
  it was made on, so a re-run that rewrites that reply wins and the
  earlier edit stays available read-only behind a "Show it" link. An
  edited reply counts as a change on its own: the card exports even with
  no decision and no note.
- **Per-card comment boxes** persisted in localStorage, with a comment
  export whose entries embed the card's verdict, suggested fix and
  paste-ready reply - the user pastes the block into a fresh Claude
  session, which then lacks the report, so each entry must be
  understandable standalone (`MY DECISION:` carries the button choice,
  `MY COMMENT:` their text; a card is exported when it has either). The export tracks what was already
  copied: "Copy new comments" skips those (so a re-run + new notes never
  re-sends handled feedback); "Copy all" re-sends everything; editing a
  copied comment makes it new again.
- **What the next copy would send is visible on the cards**: a `to copy`
  chip in the header (so a collapsed card shows it too), an outline on
  those cards while "Copy new comments" is hovered or focused, and a
  "Not copied yet (N)" viewbar toggle listing exactly that batch. That
  toggle is the one filter not persisted across loads - the batch is
  empty right after a copy, and a remembered filter would open on a
  blank page.
- **Jump to my comments** button cycling through commented cards.
- **Two-step Clear** (click again to confirm) - `window.confirm` is
  silently blocked in the artifact sandbox and reads as a dead button.

## Change something

1. Edit `core/*` (behaviour or shared look) or `skills/<name>/*` (one skill).
2. `python3 skills/_review-report-kit/build.py`
3. Test, from any directory that has jsdom installed:
   `npm init -y && npm install jsdom@24` once, then
   `node --test <repo>/skills/_review-report-kit/tests/*.test.js`
4. Never edit a `references/report-template.html` by hand; `build.py --check`
   (run by the tests) fails when a shipped file differs from the build.

## Adding a skill

Create `skills/<new-skill>/{config.js,theme.css,body.html}` (copy the closest
existing one), add a case to `tests/decisions.test.js` `CASES`, build, test.
The templates stay ES5 and self-contained: artifact pages may not load
external scripts.
