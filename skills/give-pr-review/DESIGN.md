# give-pr-review - design (2026-07-31)

The outgoing counterpart to `reply-to-pr-review`: that skill tracks reviews the
user *receives* on their own PRs; this one tracks reviews the user *gives*
on other people's PRs, from drafted finding to resolved thread, as an
interactive Claude artifact the user works from.

Decided with the user during brainstorming:

- **Report layer only** - the skill does no reviewing itself. It cards
  findings that already exist and tracks their lifecycle.
- **Full lifecycle** - two phases per finding: triage (decide what to
  post) and author tracking (after posting, watch replies/fixes until
  resolution).
- **Finding sources** - findings produced earlier in the session; if the
  session has none, invoke `lukasz-code-review` (its review steps only,
  stopping before its publish step) to produce them.
- **Manual posting** - the user posts comments on GitHub themselves; the
  report supplies paste-ready text and re-runs detect posted comments (or
  the user says "posted 1, 3, 5").
- **Forked template** - copy `reply-to-pr-review/references/report-template.html`
  into this skill's `references/` and adapt pills/sections/export; keep
  the proven CSS/JS contract. The skills stay independent.

## Identity

- Name: `give-pr-review`
- Location: `~/.claude/skills/give-pr-review/` -
  `SKILL.md` + `references/report-template.html` + this file.
- Triggering: reviewing someone else's PR *with tracking/report intent* -
  "review PR #NNN and track it", "build/refresh the outbox report", "did
  the author address my comments", "re-check PR #NNN". Must NOT capture a
  plain "review this PR" (that belongs to the regular review tooling), and
  must not capture reply-to-pr-review's territory (feedback on the user's own
  PR).

## Modes

Like reply-to-pr-review, decided by whether a report for this PR already exists
in the session or the user pastes its URL:

- **First run**: obtain findings, gather PR ground truth, build cards,
  publish.
- **Re-run**: re-fetch everything, match posted comments, track the
  author's side, flip pills, stamp the exact UTC time, republish to the
  same URL.

Accuracy beats speed: a wrongly-flipped pill or silent gap makes the user
act on wrong information.

## First run

1. **Findings**: use the session's existing review output (multi-agent
   pass, /code-review, lukasz-code-review report). If none, invoke
   lukasz-code-review to review the PR and STOP it before publishing -
   its findings become the cards.
2. **Ground truth**: `gh` GraphQL for review threads with resolution
   state, PR head SHA, and the user's already-posted comments - fetched
   only for pill matching (a finding the user already posted starts at
   `posted`), never carded as findings themselves; `git fetch` if a local
   checkout matters.
3. **Cards**: one per finding, sectioned by severity
   (`major` / `minor` / `nit`) and tagged with certainty (`verified` /
   `likely` / `unsure`) - lukasz-code-review's vocabulary. Each card:
   file:line permalink pinned to the reviewed head SHA, verdict, code
   snippet when useful, and a paste-ready
   comment drafted per lukasz-code-review's voice rules (terse, genuine
   questions, "WDYT?", concrete or nothing).
4. **Publish** the artifact; record in the report footer which head SHA
   the review is pinned to.

## Lifecycle pills

| Pill | Phase | Meaning |
|---|---|---|
| `to post` (red outline, action) | before | drafted, awaiting the user's decision |
| `skipped` (grey outline) | before | user decided not to post |
| `posted / awaiting author` (blue) | after | on the PR, ball with the author |
| `author replied - re-check` (red outline, action) | after | reply or fix arrived - user owes a look |
| `addressed` (green) | after | fix verified or thread resolved |
| `stale - re-verify` (amber, action) | either | new commits moved the code under an unposted finding |

Header tally counts pills and must equal the card count. The
"action needed only" filter shows `to post` + `re-check` + `stale`.

## Re-run mechanics

1. Timestamp via `date -u +"%Y-%m-%d %H:%M UTC"` - run it, never guess.
2. Fetch threads (GraphQL, `isResolved`), commits since the reviewed SHA,
   and the user's posted comments.
3. Match posted comments to cards by file + line + text similarity.
   Unmatched comments are listed as unmatched - never force-fitted. The
   user saying "posted 1, 3, 5" flips pills without a fetch.
4. Posted cards: author reply -> `author replied - re-check`; verified fix
   or resolved thread -> `addressed`. "Verified" means the new code was
   actually checked against the finding, not inferred from a commit
   message.
5. Unposted cards whose code moved -> `stale - re-verify`; re-verify
   against the new head before the user posts.
6. Recount the tally, republish the same file path (stable URL, stable
   favicon, short label), then summarize: what changed since the last run,
   then the current action queue.

## Report page (forked template)

Keep from reply-to-pr-review's template: collapsible cards with only action
cards expanded by default (manual toggle remembered and wins), the
status tiles + action preset, pinned/grouped label chips, the
without-my-comment toggle and the word filter, per-card comment boxes in
localStorage, copy-all export,
jump-to-my-comments, two-step Clear (window.confirm is blocked in the
artifact sandbox), both themes, stable `KEY_PREFIX` per PR (e.g.
`outbox-repo-133-`), stable card titles across re-runs.

Adapt: the pill set above, severity sections, per-draft Copy buttons
(each paste-ready comment copies individually - that is the
manual-posting path), and the copy-all export, which carries the user's
per-card notes with each card's verdict, target path:line, and draft
comment so the block is understandable by a fresh session that lacks the
report. Decision (2026-07-31, final review): copy-all stays notes-gated
as the feedback-to-Claude channel; posting to GitHub goes through the
per-draft Copy buttons, not the export.

## Error handling

- PR not accessible / `gh` unauthenticated: stop, show the failing
  command.
- No session findings and lukasz-code-review cannot run: say so; never
  fabricate cards.
- Ambiguous comment-to-card match on re-run: report both candidates and
  ask; a wrong flip is worse than a question.

## Verification

Dry-run against real data: an earlier three-perspective review of a
real PR becomes the first report; simulate a re-run after
the user posts one comment there. Implementation follows the
writing-skills discipline (test the trigger description against positive
and negative phrasings before calling it done).

## One-click decisions (2026-09-09)

Decided with the user: typing "agree" / "drop this" into every note box
was the slow part of working the report, so each card gets two toggle
buttons, `Agree - post as drafted` and `Drop`, stored per browser under
`KEY_PREFIX + "decision-" + slug(title)`, separate from the free-text
note (which stays for rephrases and reasons). The same shape went into
reply-to-pr-review and lukasz-self-review, with the same two keys (`agree`,
`drop`) so a pasted export reads the same everywhere.

- **Dropped hides by default, but not at the click.** A card with a
  local Drop, or a published `skipped` pill, hides until the viewbar's
  `Show dropped (N)` toggle is on (persisted). It is a default, not a
  filter: the "Showing N of M" line does not report it. Changed
  2026-09-09 after the user found a drop hard to notice: a card dropped in
  the current page view stays in place, dimmed with a dashed edge, title
  struck through, a `dropped` chip in the header, collapsed, and a toast
  offers Undo for seven seconds; only the next page load hides it. The
  pressed Drop button is solid grey with its label struck through. Same
  in all three templates; the harness below asserts it.
- **Export**: `MY DECISION: agree|drop` precedes `MY COMMENT`; either
  alone makes the card exported. Copy-new tracking snapshots decision +
  text, so changing either re-sends the card. Clear resets both.
- **Kept per card, not per block.** Agree covers everything the card
  proposes; a split (fix yes, comment no) goes in the text box. Rejected
  per-block buttons as double the UI for a rare case.
- **Tested** with a jsdom harness over the three templates (buttons,
  hiding, toggle count, persistence, export lines, clear, filter
  composition) plus headless-Chrome screenshots. The harness lives at
  `../_review-report-kit/tests/decisions.test.js`; its header says how to
  run it.

## Shared core (2026-09-09)

The "forked template, skills stay independent" decision above was reversed
once the same behaviour change (one-click decisions, then visible dropped
cards) had to be applied three times in two days. The three templates are
now generated by `~/.claude/skills/_review-report-kit/build.py` from a
shared `core/` plus per-skill `config.js`, `theme.css` and `body.html`. The
runtime contract is unchanged: each skill still ships one self-contained
`references/report-template.html` that Claude copies and fills, because an
artifact page may not load external scripts. lukasz-self-review gained the shared
filter model with the move (status tiles, grouped label chips including its
lens chips, quoted-phrase word filter, "Without my decision" toggle) and
lost its separate exact-phrase checkbox.

## Agreed cards collapse too (2026-09-14)

Decided with the user: only Drop collapsed its card, so after agreeing to
most findings the page was still a wall of open cards. Now Agree collapses
the card in place as well, and the two decisions look different at a
glance: an agreed card keeps its status pill (it is still to be posted),
gains a green `agreed` chip in the header and a green edge, and stays
visible on every load; a dropped card stays dimmed, struck through and
hidden from the next load on. Clicking a pressed decision again clears it
and re-opens the card. Same core, so the same shape landed in
reply-to-pr-review and lukasz-self-review; `decisions.test.js` asserts
collapse, marks, persistence and the drop-to-agree switch.

## Review file (2026-11-07)

Decided with the user: the review also lives in two JSON files per pull
request, so the Herdr pull requests panel can show the cards, take
decisions and post comments, and nothing is copied between the report
and the console. `findings.json` is written by the skill only;
`decisions.json` by the user's tool only, so neither overwrites the
other. The skill reads decisions on a re-run as it reads a pasted export
block; a decision's `posted` comment id makes matching exact. The report
stays, built from the same findings, for sharing and reading elsewhere.
Format: `references/review-file.md`, checked by
`scripts/check_review_file.py`.
