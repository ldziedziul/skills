---
name: multi-perspective-review
description: >
  Reviews the user's OWN pull request or branch from several perspectives
  at once, verifies what the reviewers found and tracks each finding
  until the PR is ready, in a review file the Herdr pull requests panel
  shows. Use when the user wants their own change reviewed before or
  between human reviews - "multi-perspective-review", "self-review", "review my
  PR/branch from different perspectives", "what would reviewers flag",
  "am I ready to mark this ready for review" - or wants that self-review
  re-run after pushing fixes, or pastes back a decisions block that quotes
  one. Not for reviewing someone else's PR (give-pr-review) and not for
  feedback the user received on their PR (reply-to-pr-review).
argument-hint: "[pr-url | branch <name>] [no report]"
---

# Self-review report

Review the user's own change from several perspectives at once, verify
what the reviewers found, and write it to a review file the user works
from in the Herdr panel until the PR is ready - and, when asked, publish
it as one self-updating artifact. Three modes, decided by whether a
review of this target already exists (in the session, its URL pasted, or
its review file):

- **First run**: resolve the target, survey the diff, pick perspectives,
  run them in parallel, merge and verify, build cards, publish.
- **Re-run** ("re-run the self-review", "I pushed the fixes"): re-fetch
  the head, re-verify every card against the new code, flip pills on
  evidence, stamp the time, republish to the same URL.
- **Apply** ("apply <pr-url>", sent by the user's tool): act on the
  decisions and notes the user made there and not yet acted on, nothing
  else (section 9).

Every run writes the review file (section 8), which the Herdr pull
requests panel shows and acts on, and a short summary in chat. The HTML
report page comes too, by default: a first run builds and publishes it.
Leave it out when the command carries `no report` (the panel sends that,
as it shows the cards itself) or the user says they don't want it. A
re-run or an apply keeps what the review already has: it republishes when the
file's `report` is set and skips the page when it is null, unless the
user asks for the report (`with report`, "publish the report").
With no report, `report` in the file is null and every "publish" or
"republish" step below is skipped. Without the Artifact tool, write the
page to a local HTML file, put its path in `report`, and give the user
the path.

The user fixes code and marks the PR ready based on this page. A finding
that was never verified, or a pill that flipped because code moved, makes
them act on wrong information - accuracy beats speed everywhere below.

**REQUIRED SUB-SKILL:** plain-english-writing for all report prose
(verdicts, header, section notes). Card titles are stable keys and stay as
written on re-runs.

## 1. Resolve the target

- A PR URL or number: `gh pr view N --json headRefOid,baseRefName,body,
  files`. Review the head SHA on origin, never the user's working tree;
  if the branch is not checked out, `git fetch origin pull/N/head` into a
  worktree or read files via `gh api`.
- No PR, or `branch <name>` (as the user's tool sends it for a branch
  without one): that branch, checked out here, against `git merge-base
  HEAD origin/<default>`. If it isn't the checked-out branch, stop and
  say so. Links are blob permalinks at HEAD; no GitHub fetches at all -
  the repository's `owner/repo` comes from the `origin` remote's URL.
- Record the head SHA; it goes in the footer and is what re-runs compare
  against.

## 2. Survey the diff, then pick perspectives

Run `git diff --stat <base>..<head>` and sort the files into areas:
production code, tests, specs and docs, CI workflows, scripts and Docker
or compose, dashboards and config, dependency manifests. Also grep the
diff for error handling (`catch`, fallback, retry, swallowed results),
new types (`record`, `enum`, `interface`, `class`), and comment or doc
volume.

Choose from this menu, keyed to what the survey shows. Every chosen
perspective and every deliberate skip goes in the header with the survey
fact behind it; an agent that failed to run is listed there too, never
silently dropped.

| Perspective | Agent | Run when |
|---|---|---|
| Correctness and project rules | `pr-review-toolkit:code-reviewer` | always |
| Test coverage and test quality | `pr-review-toolkit:pr-test-analyzer` | production code or tests changed |
| Silent failures | `pr-review-toolkit:silent-failure-hunter` | the diff adds error handling, fallbacks, retries, or async completion paths |
| Comment and javadoc accuracy | `pr-review-toolkit:comment-analyzer` | the diff adds or rewrites a lot of comments or javadoc |
| Type design | `pr-review-toolkit:type-design-analyzer` | new records, enums, interfaces, or public classes |
| Spec and description conformance | `general-purpose` with the prompt in [references/perspective-prompts.md](references/perspective-prompts.md) | the PR has a body, or specs/design docs/`docs/context` rules exist |
| Security and operations | `general-purpose` with the prompt in [references/perspective-prompts.md](references/perspective-prompts.md) | workflows, scripts, Docker or compose, downloads, dependency manifests, or config changed |

Without the `pr-review-toolkit` plugin, run its perspectives as fresh
`general-purpose` agents, each prompted with the perspective's name and
the focus its row describes.

At most five perspectives per run. When the survey justifies more, drop
comment accuracy first, then type design.

## 3. Dispatch the perspectives

Launch all chosen agents in one message so they run in parallel. Every
agent gets the same input: the repo path, the exact diff range, the head
SHA, the areas from the survey, and the instruction to read the code at
the head rather than trust commit messages or the PR body. Every agent
sees the whole diff; its perspective is a focus, not a file filter - a
test reviewer that never sees the production change cannot judge coverage.

Demand this output shape and nothing else:

```
FINDING
path: <repo-relative path>
line: <line in the new code>
severity: major | minor | nit
certainty: verified | likely | unsure
claim: <one sentence>
evidence: <what in the code shows it, quoted, at most 8 lines>
assumes: <the premise it could not check, or "none" when verified>
fix: <concrete change, or "none">
```

Zero findings is a valid result ("NO FINDINGS"). Cap each agent at ten
findings; ask for the ten it would actually type as a human reviewer.

An agent's final message is what you receive. If it says it found N and
shows fewer (it streamed the rest earlier), send it one message asking
for all N in the FINDING shape before merging; do not reconstruct them
from memory or from other agents' lists.

## 4. Merge, then verify every finding

- **Merge** findings on the same file within a few lines that make the
  same claim; keep the strongest wording and list every perspective that
  raised it as a lens chip on the card. Two perspectives that contradict
  each other become one `unsure` card quoting both.
- **Verify** each merged finding against the code at the head SHA before
  it becomes a card: open the cited lines, confirm the evidence is there,
  confirm the claim follows from it. A finding about a file outside the
  diff (base-branch code the change should have touched) is valid and
  links with a blob permalink, labelled as outside the diff. Your check
  sets the card's certainty, not the agent's label: `verified` when you
  saw the evidence prove the claim, `likely` when it holds given one
  premise you could not check, `unsure` when you could not confirm the
  evidence. The verdict of a `likely` or `unsure` card names that premise.
  A finding that is wrong is dropped, not shown as "not reproduced" - the
  page is the user's queue, not the agents' transcript.
- **Cap** at fifteen cards. Past that, keep the ones a human reviewer
  would type and fold the rest into the verdict of the card they support.
  More than fifteen is a lint dump, not a review.
- Severity and certainty are lukasz-code-review's (Step 4 tables there):
  `major` / `minor` / `nit` and `verified` / `likely` / `unsure`. Map agent
  synonyms: critical, blocker or must-fix to major; important, should-fix
  or question to minor; style to nit. An agent's `idea` is a `minor` or
  `nit`.

## 5. Build the page (unless the run has no report)

Skip this section when the run has no report (see the top).

Start from [references/report-template.html](references/report-template.html):
copy it and fill its `FILL:` sections - never write the UI from scratch. Its
CSS and JS already implement the page's behaviour (filters, decisions,
editable drafts, export), which `../_review-report-kit/README.md` describes.
The template is generated from `../_review-report-kit/`; never edit it by
hand - edit the kit and run
`python3 ${CLAUDE_SKILL_DIR}/../_review-report-kit/build.py`.

Every card carries: a **stable title**, a **status pill**, a **severity
badge** before the title (`tag sev major|minor|nit`, 🛑 / 🔧 / ✏️ come
from the theme) and a **certainty tag** after the status pill (`tag cert
verified|likely|unsure`, dot meter from the theme) (an old-label card on a re-run maps
blocker->major, question->minor, idea->minor or nit, and is `likely`
until you re-verify it), one **lens chip** per perspective that raised it, a **path:line
link** (PR changes view anchor `#diff-<sha256 of path>R<line>` when
there is a PR, computed in one batch with `printf '%s' "<path>" | shasum
-a 256`; blob permalink at the head SHA otherwise or for ranges), the
**verified verdict** with evidence, a code **snippet** when it helps, and
a **suggested fix** concrete enough to apply.

A card whose answer is words rather than code - typically one heading for
`explain in PR` - also carries a **paste-ready PR note** in a `snippet
draft` block: the sentence the user can paste into the PR description or
the thread, in their voice (lukasz-code-review's Step 3 voice rules).
Write it so it can go up unedited; the block is editable on the page, so
their wording wins from there. Cards that ship a code change do not need
one.

Keep on every run: the exact timestamp from `date -u +"%Y-%m-%d %H:%M
UTC"` in `#updated-at`; `KEY_PREFIX = "self-review-<repo>-<pr or
branch>-"` set once; stable titles; stable favicon; the same file path so
the URL never changes; a short publish label (`refresh-1446utc`); a footer
naming the head SHA, when pills were last re-verified, and which
perspectives ran.

## 6. Pills

| Pill markup | Meaning |
|---|---|
| `st tofix act` - "to fix" | open finding, the user owes a change or a decision |
| `st explain act` - "explain in PR" | user decided the code stays and owes a sentence in the PR description |
| `st stale act` - "stale - re-verify" | commits since the reviewed SHA touched the card's lines; verdict not yet re-checked |
| `st fixedlocal` - "fixed locally" | fix verified in a local commit that is not on origin |
| `st fixedpushed` - "fixed & pushed" | fix verified at the new origin head; card links the commit |
| `st explained` - "explained" | the PR description now carries the explanation |
| `st dropped` - "dropped" | user decided against it; the card keeps their reason and hides by default on the page |

Pills flip on evidence only:

- The user's decision in a pasted export or in chat ("drop 3, fix 2") is
  an instruction about that card: `MY DECISION: agree` (or "fix it")
  means apply the suggested fix under the repository's own rules (spec
  first, TDD, commit conventions); `MY DECISION: drop` flips `dropped`
  and keeps the reason from `MY COMMENT` on the card; a `MY COMMENT`
  saying the code stays and the PR description will say why flips
  `explain`.
- `fixedlocal` and `fixedpushed` require reading the new code and
  confirming it answers the finding. A commit message claiming a fix, or
  the cited lines having disappeared, is not verification - moved code
  gets `stale`, never `fixed`.
- `explained` requires the PR body to contain the explanation.
- Commits since the reviewed SHA touching a card's file and lines flip an
  open card to `stale` until re-verified.

The header tally counts pills and must equal the card count.

## 7. Acting on a pasted export

When the user pastes an export block, act on it in the same turn, then
republish; the flip rules in section 6 decide each pill:

- A PR note quoted with `(EDITED BY ME ...)` - the user rewrote it. That
  text is the explanation now: use it as given (in the PR body or the
  thread) and put it in the card's `snippet draft` block verbatim on the
  next publish - never re-word it or restore your version. If their
  wording no longer matches the verdict, say so in chat rather than
  changing either.
- `MY DECISION: agree` - apply the suggested fix under the repository's
  own rules, read the result, and flip to `fixedlocal` (or `fixedpushed`
  once it is on origin). Unverified means it stays `to fix`.
- `MY DECISION: drop` - no code change; flip to `dropped` and keep the
  reason from `MY COMMENT` on the card.
- `MY COMMENT` alone - an instruction or a question: a "code stays, PR
  description will say why" flips `explain`; a different fix is applied
  like agree; a question is answered in the summary and the card keeps
  its pill.
- `MY DECISION` and `MY COMMENT` contradict each other (drop, but the
  text asks for a change): do not act on that card; ask.

## 8. Write the review file

Every run writes the review to `findings.json`
on the machine this session runs on - for a pull request in
`${XDG_STATE_HOME:-$HOME/.local/state}/pr-reviews/<owner>/<repo>/<number>/self/`,
for a branch without one in `…/pr-reviews/<owner>/<repo>/branches/<branch>/self/`
(each `/` in the name as `%2F`, `pr: null`, `branch` set, as the format's
"A branch without a pull request" says) - so the Herdr pull requests panel
can show the cards, take the user's decisions and send them back. The
format is give-pr-review's,
[`../give-pr-review/references/review-file.md`](../give-pr-review/references/review-file.md),
with its "Self-reviews" differences: `kind: "self"`, these pills, `lens`
the perspective, `draft` the PR note or null, `suggestion` the fix,
`commit` once fixed.

- One finding per card, same order; `id` a slug of the first title,
  never changed. `reply` and `talk` as give-pr-review keeps them: the
  last note acted on, and every one.
- Write to `findings.json.tmp`, then `mv` it over `findings.json`. Never
  write `decisions.json`: it belongs to the user's tool.
- Run `python3 ${CLAUDE_SKILL_DIR}/../give-pr-review/scripts/check_review_file.py <folder>`
  and fix what it reports. A run whose file fails the check is
  incomplete.
- Whenever a conversation with the user changes a card, rewrite the file
  and the report in the same turn.

## 9. Apply

`/lukasz:multi-perspective-review apply <pr-url>` (or `apply branch <name>`
for a branch without a pull request) - sent by the user's tool when they
press Fix or Apply now - is a short run, not a re-run:

1. Read `findings.json` and `decisions.json` from the review folder.
2. Act on each entry not acted on yet, as a pasted export's (section 7):
   - `decision: "agree"` on a card still `tofix` or `stale`: apply the
     suggested fix under the repository's own rules, read the result,
     commit, and flip to `fixedlocal` with `commit`.
   - `decision: "drop"` on an open card: `dropped`, the note as reason.
   - `draft` set and not yet the card's `draft`: the user's PR note, word
     for word.
   - a `note` that isn't its `reply.note`: act on it as `MY COMMENT`,
     then set `reply` and append to `talk`.
3. Write `findings.json` (section 8), check it; if the review has a
   report, rebuild and republish
   the report.
4. Answer in chat a line per card: what you did.

Fixes need the pull request's branch checked out where this session
runs; if it isn't, stop and say so rather than fixing elsewhere.

## 10. Re-run checklist

1. Timestamp via `date -u`.
2. Read `decisions.json` from the review folder if there is one and act
   on what's new in it, as section 9 says.
3. Fetch the new head; list commits and touched files since the recorded
   SHA.
4. Re-verify every card whose lines were touched, and every card the user
   marked fixed; flip on evidence (section 6).
5. Do not re-review by default. Only when the user asks ("also review the
   new commits") run the same perspectives over the diff since the
   recorded SHA, and mark new cards with the push that introduced them.
6. Recount the tally mechanically against the card count.
7. Rewrite `findings.json` (section 8) and run the check.
8. If the review has a report, republish the same path. Summarize what changed since the last run,
   then the current queue (`to fix`, `explain in PR`, `stale`).

## Errors - stop, do not improvise

- `gh` unauthenticated or PR not accessible: fall back to local mode only
  if the branch is checked out; otherwise stop and show the failing
  command.
- An agent returns nothing parseable: retry once, then list it as failed
  in the header.
- This skill never posts to GitHub, never approves, never marks the PR
  ready. Those are the user's calls.
