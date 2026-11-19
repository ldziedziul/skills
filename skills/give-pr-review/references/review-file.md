# The review file

## Contents

- The two files and who writes them (below)
- findings.json - what Claude found, per finding
- decisions.json - what the user decided in their tool
- Follow-ups - the author's answers to posted comments
- How give-pr-review reads decisions
- Self-reviews, and a branch without a pull request
- Replies to a review

The review lives in two JSON files per pull request, so a tool other than
the report page - the Herdr pull requests panel - can show it, take your
decisions and post your comments, with nothing copied in or out:

```
${XDG_STATE_HOME:-~/.local/state}/pr-reviews/<owner>/<repo>/<number>/
  findings.json    written by give-pr-review only
  decisions.json   written by the tool you review in only
```

Each side writes only its own file, so neither overwrites the other's
work. Both live on the machine where Claude runs the review. Write a file
whole and atomically: to `<name>.tmp` in the same folder, then rename it
over `<name>`.

`scripts/check_review_file.py <folder>` checks both files against this
page; give-pr-review runs it after every write.

## findings.json

What Claude found and what it last knew about each finding.

```json
{
  "version": 1,
  "pr": {
    "repo": "acme/widgets",
    "number": 382,
    "url": "https://github.com/acme/widgets/pull/382",
    "title": "Retry failed uploads",
    "author": "octocat"
  },
  "reviewer": "ldziedziul",
  "headSha": "4f1c2e9d0a7b3c5e6f8091a2b3c4d5e6f7a8b9c0",
  "updatedAt": "2026-11-07T18:20:00Z",
  "sources": ["lukasz-code-review", "architecture", "maintainability"],
  "report": "https://claude.ai/code/artifact/...",
  "findings": [
    {
      "id": "retry-loop-never-backs-off",
      "title": "Retry loop never backs off",
      "severity": "major",
      "certainty": "verified",
      "lens": "bugs",
      "status": "topost",
      "path": "src/upload/retry.ts",
      "line": 42,
      "startLine": null,
      "side": "RIGHT",
      "link": "https://github.com/acme/widgets/pull/382/changes#diff-...R42",
      "verdict": "The loop retries at once on every failure ...",
      "snippet": { "lang": "ts", "code": "while (!ok) { ok = await run(); }" },
      "suggestion": null,
      "draft": "This retries in a tight loop. Couldn't we back off here? WDYT?",
      "labels": ["quick win"],
      "thread": null,
      "checkedAt": "4f1c2e9d0a7b3c5e6f8091a2b3c4d5e6f7a8b9c0",
      "history": [],
      "reply": { "note": "make it a question", "text": "Turned it into a question.", "at": "2026-11-07T18:34:10Z" },
      "talk": [
        { "note": "why is this major?", "text": "A down server gets a request every few ms until the job ends.", "at": "2026-11-07T18:32:00Z" },
        { "note": "make it a question", "text": "Turned it into a question.", "at": "2026-11-07T18:34:10Z" }
      ],
      "followUp": null
    }
  ],
  "unmatched": []
}
```

- `version` - 1. A reader that sees a higher one shows nothing rather than
  guessing.
- `pr` - the pull request; `author` is its author's login.
- `reviewer` - your GitHub login (`gh api user --jq .login`).
- `headSha` - the head commit the review and its links are pinned to; a
  re-run moves it to the head it re-checked.
- `updatedAt` - when Claude last wrote the file, from `date -u`, ISO 8601
  in UTC.
- `sources` - the review passes the findings came from.
- `report` - the published report page, or null.
- `findings` - one per card, in the report's order.
  - `id` - stable for the life of the review: a slug of the first title,
    never changed when the title is. Decisions are keyed by it.
  - `title` - the card's title.
  - `severity` - `major`, `minor` or `nit`.
  - `certainty` - `verified`, `likely` or `unsure`.
  - `lens` - `bugs`, `architecture` or `maintainability`: which pass it
    came from.
  - `status` - the card's pill: `topost`, `skipped`, `posted`, `recheck`,
    `addressed` or `stale`.
  - `path`, `line`, `startLine`, `side` - where the comment goes, as
    GitHub's review comments take it: `line` the last line, `startLine`
    the first of a range or null, `side` `RIGHT` for the new code and
    `LEFT` for removed lines. `path` and `line` are null for a comment on
    the whole pull request.
  - `link` - the card's link into the diff, or a permalink.
  - `verdict` - the verdict with its evidence, Markdown.
  - `snippet` - `{ lang, code }` of the code in question, or null.
  - `suggestion` - a unified diff of a concrete fix, or null.
  - `draft` - the paste-ready comment, Markdown: what gets posted.
  - `labels` - the card's label chips.
  - `thread` - `{ url, commentId }` once the comment is on GitHub (from a
    decision's `posted`, or matched on a re-run), else null.
  - `checkedAt` - the head commit the finding was last verified against.
  - `history` - what changed on the card on earlier runs, oldest first:
    `{ at, note }`, e.g. "author replied; re-checked, still open".
  - `reply` - the last note of yours Claude acted on, verbatim, what it
    did or its answer (one or two plain sentences) and when:
    `{ note, text, at }`, or null. A note equal to `reply.note` is
    answered; any other note is still to act on.
  - `talk` - every note Claude acted on for this finding and its reply,
    oldest first, the same `{ note, text, at }`; the last is `reply`.
    Your tool shows it as the finding's conversation, and may empty the
    note once it's answered, for the next one. Optional; none is `[]`.
  - `followUp` - what the author did about your posted comment and what
    Claude makes of it (see Follow-ups), or null. Optional; give-pr-review
    only.
- `unmatched` - your comments on the pull request that match no card:
  `{ url, body, note }`, `note` naming candidate cards when ambiguous.

## decisions.json

What you decided about each finding, written by the tool you review in.
give-pr-review never writes it.

```json
{
  "version": 1,
  "decisions": {
    "retry-loop-never-backs-off": {
      "decision": "agree",
      "draft": "This retries in a tight loop - couldn't it back off?",
      "draftBase": "This retries in a tight loop. Couldn't we back off here? WDYT?",
      "note": "",
      "posted": { "commentId": 1834455120, "url": "https://github.com/acme/widgets/pull/382#discussion_r1834455120", "at": "2026-11-07T18:31:02Z" },
      "at": "2026-11-07T18:30:40Z"
    }
  }
}
```

- `decisions` - by finding `id`. A finding without an entry has no
  decision yet.
  - `decision` - `agree` (post it as the draft stands), `drop` (don't
    post it) or null.
  - `draft` - your rewrite of the comment, or null for Claude's draft.
  - `draftBase` - the `draft` of findings.json your rewrite was made on.
  - `note` - free text for Claude: a question, "rephrase", a reason for
    dropping.
  - `sent` - the `note` as the tool last sent it to you, so it can show
    it as asked; the tool's own, nothing to act on.
  - `posted` - `{ commentId, url, at }` once the tool posted the comment,
    else null. With `draft: true` the comment is in your draft (pending)
    review on GitHub, which only you see; the tool clears it once the
    review is submitted.
  - `at` - when you last changed the entry.
  - `followUp` - your decision on the finding's follow-up (see
    Follow-ups), or null. Optional.

## Follow-ups

Once your comment is on GitHub (`thread` set), it may be answered: a
reply in its thread by the author or another reviewer, a commit by the
author that changes its lines or file after `checkedAt`, or both. A re-run then writes a `followUp` on the finding:

```json
{
  "key": "c1834461001+9f3a2b1",
  "did": "both",
  "commit": { "sha": "9f3a2b1c0d4e5f60718293a4b5c6d7e8f9012345", "url": "https://github.com/acme/widgets/commit/9f3a2b1c0d4e5f60718293a4b5c6d7e8f9012345" },
  "replies": [{ "commentId": 1834461001, "url": "https://github.com/acme/widgets/pull/382#discussion_r1834461001", "body": "Added a backoff, capped at 30 s.", "user": "octo" }],
  "summary": "Added an exponential backoff capped at 30 s and replied.",
  "verdict": "ok",
  "why": "`retry.ts:42` now waits `min(2^n * 100 ms, 30 s)` between attempts.",
  "draft": "fair enough",
  "drafts": { "ok": "fair enough", "notok": "Couldn't we cap the attempts too? WDYT?" },
  "threadId": "PRRT_kwDOAbCd1234",
  "resolved": false,
  "at": "2026-11-11T09:12:00Z"
}
```

- `key` - what this follow-up answers, in exactly this form, so every run
  builds the same one: `c<commentId>` for each of the `replies`,
  ids ascending, then the commit's first 7 SHA characters, joined by `+`.
  A reply alone is `c1834461001`, a fix alone `9f3a2b1`, two replies and
  a fix `c1834461001+c1834462050+9f3a2b1`. A new answer gets a new key,
  so a decision made on an older one doesn't carry over.
- `did` - `fix`, `reply` or `both`.
- `commit` - `{ sha, url }` of the commit that changed the lines, or null.
- `replies` - the replies since your last comment in the thread, by
  anyone but you (the author, other reviewers): `{ commentId, url, body,
  user }`, `user` their login. Older files have no `user`: the author.
- `summary` - what the author did, or what the others said, one or two
  plain sentences, naming who when it isn't the author.
- `verdict` - `ok` (the fix is right in the new code, or the argument
  holds) or `notok` (the fix is incomplete or wrong, or the argument
  misses something). A commit message is not evidence: `ok` on a fix
  means the new code was read.
- `why` - the evidence for the verdict, Markdown, links at the new head.
- `draft` - the reply in your voice for `verdict`; `""` for an ok fix
  (`did` `fix` or `both`): resolve only, no thank-you.
- `drafts` - a reply for each verdict, `{ ok, notok }`, so your tool can
  swap them when you flip the verdict; `draft` is the one for `verdict`.
- `threadId` - the review thread's GraphQL id, for resolving it. Null for
  a comment on the whole pull request: no thread to resolve.
- `resolved` - whether the thread was resolved when Claude looked: the
  author may resolve it with the fix.
- `at` - when Claude wrote it.

A comment on the whole pull request (`path` null) has no thread: an
author conversation comment answers it only when it quotes that comment,
and a commit never does.

Statuses, with a follow-up:

- A finding with a `followUp` you haven't sent or skipped is `recheck`,
  even when the fix is right: you see it and resolve the thread.
- Sent (its decision's `sent` is set, see below): ok -> `addressed`, not
  ok -> `posted` (the author's turn again). This holds for a thread the
  author resolved too: there an ok follow-up needs no resolve, and a
  not-ok reply reopens it. The follow-up goes to `history` as a note ("author fixed
  in 9f3a2b1; ok, resolved") and `followUp` back to null until the
  author answers again.
- A thread resolved with no answer to check -> `addressed`.

Your decision on it, in the finding's `decisions.json` entry:

```json
{
  "key": "c1834461001+9f3a2b1",
  "decision": "agree",
  "verdict": null,
  "draft": null,
  "draftBase": null,
  "posted": { "commentId": 1834469999, "url": "https://github.com/acme/widgets/pull/382#discussion_r1834469999", "at": "2026-11-11T09:20:00Z" },
  "resolved": "2026-11-11T09:20:01Z",
  "sent": "2026-11-11T09:20:01Z",
  "at": "2026-11-11T09:19:40Z"
}
```

- `key` - the `followUp.key` it's about; one with another key is ignored.
- `decision` - `agree` (send it), `drop` (leave the thread) or null.
- `verdict` - your override of Claude's, `ok` or `notok`, or null.
- `draft`, `draftBase` - your rewrite of the reply and the draft it was
  made on, as for the comment.
- `posted` - `{ commentId, url, at }` of the reply once posted, or null.
- `resolved` - when your tool resolved the thread (or reopened it, for a
  not-ok reply on a resolved one), or null.
- `sent` - when nothing of it was left to send: the reply posted (or none
  needed) and the thread resolved or reopened (or no need, as for an ok
  fix on a thread the author resolved). Null until then: a follow-up
  half sent - the reply out, the resolve failed - isn't sent.
- `at` - when you last changed it.

Your tool posts and resolves; Claude never does. On a re-run, a
`followUp` decision with the finding's key and `sent` set was sent: the
status moves as above. `drop` keeps the finding `posted`,
with a `history` note, and keeps its `followUp`: a re-run doesn't write
it again for the same key, so a skipped answer stays skipped until the
author answers again (a new key).

## How give-pr-review reads decisions

On a re-run, before matching comments, each entry is applied as the
pasted export block's would be (SKILL.md section 5):

- `draft` set and not yet the finding's `draft` - your wording is the
  comment now: copy it verbatim into the finding's `draft`. If
  `draftBase` isn't the finding's `draft` either, Claude rewrote the
  comment after you edited it: keep yours and say so in the summary.
- `decision: "drop"` - `status: "skipped"`, keeping `note` as the reason
  in `history`.
- `decision: "agree"` - nothing to change; it flips to `posted` once
  posted.
- `posted` set - `status: "posted"` and `thread` from it: an exact match,
  no text matching needed. With `draft: true` the comment isn't
  submitted yet: still `posted`, and the author can't have replied.
- `note` not yet `reply.note` (and not empty) - act on it, as
  `MY COMMENT`: change the comment, re-verify the finding or answer the
  question, then set `reply` to that note, what you did or your answer,
  and the time, and append the same to `talk`. Read `talk` first: a
  note may follow up on an earlier answer. A
  change to the comment goes to the finding's `draft`, made on the
  comment as it stands - your rewrite, if you made one; your tool then
  takes Claude's text over your rewrite. A note equal to `reply.note`
  was answered before: leave it.
- `drop` with a `note` asking for a change - don't act on that finding;
  ask.

## Self-reviews

lukasz-self-review writes the same two files for a review of your own
pull request, in a folder of its own beside give-pr-review's:

```
${XDG_STATE_HOME:-~/.local/state}/pr-reviews/<owner>/<repo>/<number>/self/
```

Everything above holds, except:

- `kind` - `"self"`. give-pr-review's files leave it out (or say
  `"give"`).
- `status` - the self-review's pills: `tofix`, `explain`, `stale`,
  `fixedlocal`, `fixedpushed`, `explained` or `dropped`.
- `lens` - the perspective that raised it, as the report's lens chip
  names it (e.g. `correctness`, `tests`, `silent failures`); the others
  that raised it go in `labels`.
- `draft` - the paste-ready PR note, for a card whose answer is words
  (`explain`): the sentence for the PR description. Null for a card that
  ships a code change.
- `suggestion` - the suggested fix, as a unified diff or a short
  description; what Agree applies.
- `commit` - `{ sha, url }` of the commit that fixed it, once
  `fixedlocal` or `fixedpushed`, else null.
- `thread` - unused: null.

In `decisions.json`, `decision: "agree"` means fix it (apply the
suggested fix under the repository's rules), `drop` means leave the code
as it is; `draft` is your rewrite of the PR note; `posted` is unused.

### A branch without a pull request

A self-review of a branch that has no pull request yet goes in the
branch's folder, its name with each `/` written `%2F`:

```
${XDG_STATE_HOME:-~/.local/state}/pr-reviews/<owner>/<repo>/branches/<branch>/self/
```

- `pr` - null.
- `branch` - `{ repo, name, base, head }`: `owner/repo`, the branch's
  name, the branch it's compared with (`origin/main`, say) and the head
  commit reviewed.
- `link` - a permalink at the head commit, as there is no pull request
  diff to point into.

The commands name the branch instead of a pull request URL:
`branch <name>`, `apply branch <name>`, `re-run branch <name>`. When the
branch gets a pull request, the next run on it moves to the pull
request's folder.

## Replies to a review

reply-to-pr-review writes the same two files for the review feedback you
received on your own pull request, one card per reviewer thread, in a
folder of its own:

```
${XDG_STATE_HOME:-~/.local/state}/pr-reviews/<owner>/<repo>/<number>/reply/
```

Everything in the first sections holds, except:

- `kind` - `"reply"`.
- `reviewer` - on each finding: the login of who wrote the feedback.
- `quote` - a short quote of their feedback.
- `section` - what happens next: `code` (needs a code change), `docs`
  (a doc correction), `answer` (answerable in the thread) or `decision`
  (a cost or scope call for the team). Findings are shown by it.
- `severity`, `certainty` - may be null.
- `lens` - unused: null.
- `status` - `action` (on you), `fixedlocal` (committed, not pushed:
  links to it are dead for the reviewer), `fixedpushed`, `replied`
  (awaiting the reviewer), `none` (no action) or `dropped`.
- `replyMissing` - true when a pushed fix's thread has no reply of yours
  linking it yet.
- `thread` - required: `{ url, commentId, type }`, `type` one of
  `review-comment` (an inline thread: replies go to it),
  `review` (a review's body) or `issue-comment` (the conversation): the
  reply to those two is a new comment on the pull request.
- `draft` - the paste-ready reply, or null for a thread that owes none.
- `suggestion` - the suggested fix, as for a self-review.
- `commit` - `{ sha, url }` of the fix, once there is one.

In `decisions.json`, `decision: "agree"` means do what the card says:
fix the code and commit, if the card has a fix, and post the reply. The
tool you decide in posts the replies itself - Claude doesn't post a
reply the tool will - and records each as `posted`, which makes the
card `replied`. `drop` leaves the thread alone.
