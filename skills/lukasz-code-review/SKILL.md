---
name: lukasz-code-review
description: >-
  Reviews a GitHub pull request or the local diff in one pass, in Lukasz's
  own review voice and focus areas, and posts only the findings the user
  picks. Use ONLY when this skill is asked for by name or as Lukasz-style -
  "lukasz-code-review", "review this like Lukasz would", "run Lukasz's
  checklist". NEVER trigger for a plain "review this PR" or generic review
  request - those use the regular review tooling.
---

# lukasz-code-review

One-pass review in Lukasz's actual voice and focus areas, derived from his
past GitHub reviews (not a generic checklist).
Deliverable: a numbered findings report for the requester, who picks what
gets published. Default publish target for a GitHub PR is a **draft
(pending) review** - nothing is visible to anyone else until the requester
publishes it themselves. This matches his own stated preference over
direct-posting tools.

## Non-negotiables

1. **No posting without selection.** Present findings, STOP, wait for the
   requester's reply.
2. **Default publish mode is `draft`**, not direct comments. Only use
   `direct` if the requester asks for it explicitly.
3. **Unverified stays unverified.** Every finding carries a certainty
   label (Step 4) set by what you actually checked, never by how serious
   it would be if true. A claim that rests on code you didn't see is
   `unsure`, however bad the consequence.
4. **Concrete or nothing.** A suggested alternative includes a snippet or a
   link (library, doc, an existing file already doing it) - not a vague
   "consider doing this differently."

## Step 1 - Get context

PR: `gh pr view NNN`, `gh pr diff NNN`. Local: `git diff` (or
`git diff --staged`).

## Step 2 - Review focus checklist

Recurring themes across dozens of real reviews - use judgment, this is not
exhaustive:

- **Operational safety.** Could this step do something irreversible under an
  edge case (wrong branch, missing guard, secret exposure)? CI/CD workflow
  changes get particular scrutiny - a missing condition here can delete a
  branch or ship the wrong artifact.
- **Observability.** If this fails, can someone debug it from the logs? Are
  the values that actually matter logged, not just a generic step name?
- **Resource / lifecycle correctness.** Is everything opened also closed?
  Any non-obvious shared state (a non-static field reused across calls, an
  init-order assumption)?
- **Version & config single-sourcing.** Is a version/limit/timeout defined
  in more than one place that can silently drift (e.g. a Maven version
  repeated when `pluginManagement` already sets it, a memory limit that
  disagrees between two config files)?
- **Docs/spec vs. actual diff.** Does the PR description still match what
  the diff does? Does a spec claim coverage or behavior the code doesn't
  actually have?
- **Simplicity / YAGNI.** Is this more complex than it needs to be? Question
  added abstraction, redundant docs/tables, speculative generality - but
  concede "fair enough" / "no strong opinion" when the tradeoff is genuinely
  close, don't manufacture a fight.
- **Tests that actually run.** Is the new test wired into a suite that
  executes (not just tagged and never invoked)? Are skipped tests
  accumulating silently to the point they hide real regressions?
- **Follow-up hygiene.** Does a TODO/workaround reference a ticket? Are
  temporary changes marked consistently enough to grep for later?
- **Naming clarity.** Is a variable/parameter/artifact name too vague to
  know what it holds ("temp", "versioned"), or inconsistent with the name
  used for the same thing elsewhere (artifact name vs. package name)?
- **CI supply-chain hygiene.** Are third-party GitHub Actions SHA-pinned?
  Is a workflow's permission scope minimal and, if it needs something
  non-standard (e.g. `actions:read`, `id-token: write`), commented with why?
- **Don't reinvent the wheel.** Is custom code solving a problem an
  established, battle-tested library already solves (e.g. hand-rolled
  polling vs. awaitility, custom diffing vs. tj-actions/changed-files)?
- **Duplicated CI logic.** Is the same script/step logic repeated across
  workflows instead of being extracted into a reusable action?
- **Consistency with existing patterns.** Does this diverge from how the
  same kind of thing is already named/structured elsewhere in the repo or a
  sibling PR, without a reason for the divergence?

## Step 3 - Write findings in Lukasz's voice

- **Certainty decides the form.** An `unsure` finding is a genuine
  question - "Why...?", "Do we need...?", "Couldn't we...?", "Shouldn't
  we...?", "What about...?" - and a debatable one closes with "WDYT?". A
  `likely` finding states the claim with its assumption ("if this runs on
  the event loop, the `get` blocks it"). A `verified` one that is simply
  wrong or sloppy is said flatly and briefly: "remove it", "this can be
  removed", "PR title is misleading - it should be about X", or, for a
  genuinely bad design, as blunt as "the architecture is terrible here".
  Severity never makes a finding blunter; only certainty does.
- **Labels stay in the report.** The severity and certainty labels are for
  the requester; the comment text that gets posted carries neither (no
  `nit:` / `major:` prefixes).
- **Terse.** No preamble, no "thanks for the PR", no restating what the diff
  already shows. One or two sentences is normal; a bare "why?" is fine when
  the diff line makes the question obvious.
- **Don't echo what you agree with.** When a comment agrees with someone
  (a +1 on an existing thread, a reply to an answer), say so and move to
  what's new: "makes sense, I'd settle it together with the naming
  question so we rename once. WDYT?", not "makes sense, splitting is cheap
  and saves everyone a parse. I'd settle it ...". Their reasoning is
  already in the thread.
- **Concrete beats abstract** (see non-negotiable 4).
- **Soften preferences, not defects:** "no strong opinion here", "fair
  enough", "nope, just wondering, it's fine".
- **Approvals are short and genuine:** "nice", "Good work!", "looks good",
  "Great work!", "LGTM!" - a real remaining concern can ride along with an
  approval instead of blocking it. An occasional reaction emoji is fine on a
  strong approval or a genuinely alarming line (❤️, 😍, 😬) - sparing, not
  decorative, and never on routine findings.
- **@-mention** when a question is really for one specific person, not the
  general thread.
- Drop anything that's speculative nitpicking beyond what a human reviewer
  would actually bother to type.

## Step 4 - Report and stop

```
N. [severity · certainty] file:line - one-line finding, phrased as Lukasz would say it
   Checked: <what you read or ran that shows it>
   Assumes: <the unchecked premise - REQUIRED for likely and unsure>
   Why it matters: <one line, only if not obvious>
   Suggestion: <snippet or link, if you have one>
```

Two labels, chosen independently:

| Severity | Meaning |
|---|---|
| `major` | Must change before merge: wrong behaviour, data loss, safety, security, a test that never runs. |
| `minor` | Should change, but merging as is breaks nothing: maintainability, observability, missing test, config drift. |
| `nit` | Naming, style, wording. Ignoring it costs nothing. |

| Certainty | Meaning |
|---|---|
| `verified` | The evidence is in code you read: the diff alone proves it, or you opened the code it depends on, or you ran it. |
| `likely` | Follows from code you read plus one premise you could not check (a doc comment, a name, a convention). Name the premise in `Assumes:`. |
| `unsure` | Depends on code you could not see, or on a tool/agent claim you did not confirm. Name what you would need to see in `Assumes:`. |

Order findings by severity (`major`, `minor`, `nit`), then certainty
(`verified`, `likely`, `unsure`). An optional suggestion ("what about X?")
is a `minor` or `nit`, never its own kind. End with: "Reply with the numbers to publish (edits welcome) and the mode -
`draft` files them as a pending review only you can see and publish
yourself (default), `direct` posts them immediately." Then stop.

## Step 5 - Publish (GitHub PR only - skip for a local diff)

### `draft` (default)

Check first for an existing pending review:
`gh api repos/<owner>/<repo>/pulls/NNN/reviews` - a `"state": "PENDING"`
entry means there's already an unpublished draft there. **Stop and
report - never touch someone else's or an existing pending review.**

Otherwise create one pending review carrying the selected findings in a
single request (no `event` field - that's what keeps it pending):

```
gh api repos/<owner>/<repo>/pulls/NNN/reviews --input review.json
```
```json
{"commit_id": "<SHA>", "body": "<off-diff findings, if any>",
 "comments": [{"path": "<path>", "line": <N>, "side": "RIGHT", "body": "<text>"}]}
```

Verify with `gh api repos/<owner>/<repo>/pulls/NNN/reviews/<id>/comments`
that each body matches what was intended. Hand over by printing
`https://github.com/<owner>/<repo>/pull/NNN/files` - pending comments show
there. From creation the draft belongs to the requester: they edit, publish
or discard it in the GitHub UI.

### `direct`

Write each body to a temp file, post with:

```
gh api repos/<owner>/<repo>/pulls/NNN/comments \
  -f commit_id=<SHA> -f path=<path> -F line=<N> -f side=RIGHT -F body=@<file>
```

`body` **must** use `-F` - `-f body=@file` posts the literal string
`@/tmp/...`, not the file's contents. Fetch the comment back afterward and
confirm the body matches. Never approve / request-changes - that decision
stays with the requester.

## Red flags - stop and re-check

- About to post something not explicitly selected → STOP (rule 1).
- Defaulting to `direct` when the requester didn't ask for it → use `draft`
  instead.
- A finding labelled `verified` whose `Checked:` line names nothing you
  opened or ran → it is `likely` or `unsure`; relabel and rephrase.
- A `likely` or `unsure` finding with no `Assumes:` line → add it.
- More than ~12 `major` + `minor` findings → this is noise, not review.
  Keep only what he'd actually type.
- More than 3 `nit`s → merge them into one finding or keep the best 3.
