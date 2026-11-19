# Following up on the author's answers - design (2026-11-11)

## Why

After you review someone's pull request with give-pr-review, the author answers:
a commit that fixes it, a reply that pushes back, or both. Today a re-run of
the review only flips the card's pill ("author replied - re-check",
"addressed", "stale"). You still open each thread, read the new code, decide
whether the answer holds, and write back - "fair enough" when it does, a
pointed question with a link when it doesn't (as on #306, where a permalink to
the chart's README line got the author to rewrite it) - and resolve the thread.

This adds that step to the re-run and to the Herdr pull requests panel: per
card, what the author did, whether Claude thinks it's ok, and a reply in your
voice that the panel posts and, when ok, resolves the thread with.

## Goals

- A re-run of Review tells you, per posted comment the author answered, what
  they did (fixed in a commit, replied, both) in a sentence or two.
- Claude's verdict on that answer: **ok** (the fix is right in the code, or the
  argument holds) or **not ok** (fix incomplete or wrong, or the argument
  misses something), with the evidence, as the finding's verdict has it.
- A paste-ready reply in your voice, one per answered thread:
  - ok after a reply: a short acceptance ("fair enough").
  - ok after a silent fix: no reply - the action is to resolve the thread; you
    can still type one.
  - not ok: a short pointed question or what's still missing, with a permalink
    at the new head to what shows it.
- In the panel you agree or skip, can flip the verdict, can edit the reply,
  and one button sends it: **ok** posts the reply (if any) and resolves the
  thread; **not ok** posts the reply and leaves the thread open.
- A summary at the top of Your review: how many were fixed, replied to, ok,
  not ok, and how many follow-ups wait on you.
- The next re-run knows what was sent and resolved, with nothing copied.

## Non-goals

- Approving the pull request. "Resolve and approve" already does that, and
  stays as it is: it resolves every open thread you started, follow-ups not
  ok or unsent included, as a deliberate override.
- Posting anything without your click.
- Following up on comments that aren't on GitHub yet (to post, skipped).
- New findings on the new commits: a re-run is still not a fresh review.
- The opt-in HTML report: it keeps showing the pill only.

## Anti-goals

- A verdict on a commit message's claim. "Fixed in abc123" is not evidence;
  ok means the new code was read and answers the finding, as `addressed`
  already requires.
- Replies that don't sound like you: long, polite filler, or "nit:" labels.
  The voice is the one the drafts already use (terse; "Couldn't we ...?",
  "WDYT?", "fair enough").
- Resolving a thread the verdict says is not ok, or one you didn't open.

## Where things live

Two pieces agree on the review file
(`skills/give-pr-review/references/review-file.md`), which this design
extends:

- **give-pr-review** (this repo) writes the follow-up into `findings.json`.
- **herdr-prs** (`~/projects/herdr-prs`, `mods/prs`) shows it, writes your
  decision into `decisions.json`, posts and resolves.

## The review file

### findings.json: `followUp` on a finding

Set on a re-run for a finding whose comment is on GitHub (`thread` set) when
the author answered since your last word in that thread: a reply in it, a
commit touching its lines or file after `checkedAt`, or both. Else null.

A comment on the whole pull request (`path` null) has no thread: an author
conversation comment counts as an answer to it only when it quotes that
finding's comment; a commit never does. Anything less certain is left
without a follow-up, as a wrong match is worse than none. *My call.*

```json
"followUp": {
  "key": "c1834461001+9f3a2b1",
  "did": "both",
  "commit": { "sha": "9f3a2b1...", "url": "https://github.com/acme/widgets/commit/9f3a2b1..." },
  "replies": [{ "commentId": 1834461001, "url": "...", "body": "I would keep the toggle..." }],
  "summary": "Kept the toggle and explained the runner cost; no code change.",
  "verdict": "ok",
  "why": "An always-on schedule costs about 12 runner hours a month, and the gap only opens when a teardown fails, which the person running the soak watches.",
  "draft": "fair enough",
  "drafts": { "ok": "fair enough", "notok": "Couldn't we keep the schedule always on anyway? WDYT?" },
  "threadId": "PRRT_kwDO...",
  "resolved": false,
  "at": "2026-11-11T09:12:00Z"
}
```

- `key` - what this follow-up answers: the author's reply comment ids and
  the commit's short sha. A new answer gets a new key, so a decision made on
  an older one doesn't carry over.
- `did` - `fix`, `reply` or `both`.
- `commit` - the commit that changed the lines, or null.
- `replies` - the author's replies since your last comment in the thread.
- `summary` - what the author did, one or two plain sentences.
- `verdict` - `ok` or `notok`.
- `why` - the evidence for the verdict, Markdown, with links at the new head.
- `draft` - the reply in your voice for Claude's verdict; `""` for an ok
  silent fix (resolve only).
- `drafts` - a reply for each verdict, `{ ok, notok }`, so flipping the
  verdict in the panel swaps in the other one (`draft` equals the one for
  `verdict`). *My call.*
- `threadId` - the GraphQL id of the review thread, for resolving. Null for
  a comment on the whole pull request, which has no thread to resolve.
- `resolved` - whether the thread was resolved when Claude looked (the
  author may resolve it with the fix): the panel then reopens it for a
  not-ok reply and doesn't resolve it again for an ok one. *My call.*
- `at` - when Claude wrote it.

Status, alongside it:

- A finding with a `followUp` you haven't acted on is `recheck` (action
  needed), whatever `did` is. Today's rule that a verified fix goes straight
  to `addressed` gives way to this: you get to see and resolve it.
- Once you've sent it (see below): ok -> `addressed`; not ok -> `posted`
  (the ball is with the author again). The follow-up moves to `history` as
  `{ at, note }` ("author fixed in 9f3a2b1; ok, resolved") and `followUp`
  goes back to null until the author answers again.
- A thread the author resolved after answering still gets a `followUp`: the
  fix is checked like any other. Ok -> `addressed` once you've seen it (no
  resolve needed); not ok -> sending the reply also reopens the thread
  (`unresolveReviewThread`), so it doesn't sit in a closed one.
- A thread resolved with no answer to check (you resolved it, or nothing
  changed) -> `addressed`, as today.

### decisions.json: `followUp` on a decision

```json
"followUp": {
  "key": "c1834461001+9f3a2b1",
  "decision": "agree",
  "verdict": null,
  "draft": null,
  "draftBase": "fair enough",
  "posted": { "commentId": 1834469999, "url": "...", "at": "..." },
  "resolved": "2026-11-11T09:20:00Z",
  "at": "2026-11-11T09:19:40Z"
}
```

- `key` - the `followUp.key` this decision is about. One with another key is
  ignored (a newer answer came).
- `decision` - `agree` (send it), `drop` (leave the thread as it is) or null.
- `verdict` - your override of Claude's, `ok` or `notok`, or null.
- `draft`, `draftBase` - your rewrite of the reply, as for the comment.
- `posted` - the reply once posted, or null (none, or a resolve-only).
- `resolved` - when the panel resolved the thread, or null.

give-pr-review reads it on the next re-run: `posted` or `resolved` with a
matching key means the follow-up was sent, and the status moves as above. A
`drop` keeps the finding `posted` and records it in `history`. A decision's
`note` already reaches Claude through the finding's existing note and talk;
nothing new there.

## give-pr-review

On a re-run (SKILL.md section 8), after matching threads and before
re-verifying:

1. For each finding with a `thread`, fetch the thread's comments and its
   GraphQL id and `isResolved` (an author-resolved thread is still checked),
   and the commits since `checkedAt` that touch
   its file.
2. If the author answered since your last comment there and there's no
   follow-up with that key yet, read the new code and the reply, and write
   `followUp` as above. Apply the existing `addressed` evidence rule to `ok`.
3. Apply `decisions.json`'s `followUp` entries first, so a sent follow-up
   isn't written again.
4. The summary at the end of the run lists the follow-ups: per card, what
   the author did and the verdict.

The voice rules for `draft` are the comment's (the user's voice skill).

## herdr-prs panel

In the pull request's Your review tab:

- **Summary bar** at the top, while any finding has a `followUp`: "Since
  your review: 3 fixed, 2 replied - 4 ok, 1 not ok", and a green "Send N"
  for the agreed ones not sent yet.
- The card's buttons work as the existing cards' Agree and Drop do: they
  record a decision; "Send N" (and a per-card "Send" for an agreed one) does
  the posting and resolving. One code path, as "Post N agreed" has today.
  *My call.*
- **On the card**, between the comment and the discussion, a "SINCE YOUR
  COMMENT" block: the author's replies (quoted, with Open thread), the
  commit link, the summary, the verdict as a chip (OK green, NOT OK red) that
  you can flip, `why`, the reply in an editable box, and the buttons:
  - ok: "Agree - post and resolve", or "Agree - resolve" while the reply
    is empty.
  - not ok: "Agree - post reply" (and reopen, when the thread is resolved).
  - "Skip" - leaves the thread alone.
  On an ok follow-up whose thread is already resolved, the ok button only
  posts the reply, if any.
  Flipping the verdict swaps the box to the other draft, unless you edited it.
  Sending posts into the thread (the same
  request as the Replies tab: into an inline thread, or a pull request
  comment quoting the author when there's no thread), then resolves it with
  the existing `resolveReviewThread` mutation when ok, and writes `posted`
  and `resolved`.
- Cards with an unsent follow-up count as waiting on you (the row's "Your
  review: N", the tab's count, "Action needed only").

## Left to the builder

- Layout and wording of the summary bar and the card block, within the
  panel's existing look (RECIPE.md).
- How the skill finds a commit's relevance to a finding (lines vs file).
- Tests: the review-data helpers in herdr-prs are tested on their own
  (`tests/review-data.test.mjs`); `check_review_file.py` gets the new fields.
