# Review queue triage - design (2026-11-12)

## Why

Several pull requests wait for your review at once. Before opening any, you
want to know which are quick to read yourself, which to hand to Claude's
review first, which need your full attention, and, for ones you already
reviewed, where the ball is: approve it, look at the author's answers, or
wait for them.

## Goals

1. **Instant size and area, no Claude.** The Herdr pull requests panel works
   out, for each open pull request waiting for your review, a size (S, M, L,
   XL) from lines and files changed - lockfiles and generated files left out
   - and the riskiest area it touches, from path rules: generic ones, plus
   optional per-repository rules. One pill on the row, e.g. `S · docs`,
   colored by risk (low grey, medium amber, high red).
2. **A quick Claude assessment, on demand.** A new skill, `pr-triage`,
   reads a pull request's description and diff (no review) and writes a
   small `triage.json`: a recommendation - `quick` (read it yourself in
   minutes), `claude` (run give-pr-review first, then read its cards) or
   `deep` (needs your full attention: a contract change, concurrency, data
   migration, security) - an estimate in minutes, the areas it touches with
   their risk, and one plain sentence why. The panel shows it as a pill
   ("quick ~10m", "Claude first", "deep") with the sentence as its tooltip;
   one made on an older head shows as old.
   - "Assess all" on the "waiting for your review" heading starts it on the
     whole queue, in one tab per repository; Assess on a row's menu and in
     the pull request view's top bar starts it on one.
3. **Markers on the ones you reviewed** (give-pr-review's review file):
   - `🛑 N major` - open major findings, before the existing count.
   - `new commits` (amber) - the head moved since your review.
   - `answers: N` - follow-ups waiting on you.
   - `ready to approve` (green) - nothing waits on you or the author.
   - `with author` (muted) - only posted comments the author hasn't
     answered.
4. **The queue sorted by what to do.** "Waiting for your review" splits into
   small groups, in this order: Ready to approve, Answered (follow-ups or new
   commits), In review (findings still to post), Quick, Claude first, Deep,
   Not assessed, With author. Inside a group, the quickest first (Claude's
   minutes, else size).

## Non-goals

- Running give-pr-review or approving automatically.
- Assessing pull requests that don't wait for your own review.
- Committing area rules into the reviewed repositories.

## Decided

- Panel copy is in English, as the rest of the panel ("quick", "Claude
  first", "deep", "ready to approve", "with author", "answers").
- Claude's assessment runs only when asked (Assess / Assess all), not on its
  own: it costs tokens per pull request.
- `triage.json` lives in the pull request's review folder,
  `${XDG_STATE_HOME:-~/.local/state}/pr-reviews/<owner>/<repo>/<number>/`,
  beside give-pr-review's files; nothing else reads or writes it.
- Per-repository area rules live with the panel's data,
  `~/.config/herdr-app/data/prs/areas.json`, keyed by `owner/repo`: an
  ordered list of `{ pattern, label, risk }` (a regular expression on the
  path). The generic rules apply after them.
- Generic rules: lockfiles and dependency manifests -> deps, low; `*.md`
  and `docs/` -> docs, low; test paths -> tests, low; `.github/`, CI and
  container files -> CI, medium; anything else -> code, medium.
- Size: S up to 50 lines and 5 files, M up to 300 and 15, L up to 1000 and
  40, XL above; the larger of the two decides.

## triage.json

```json
{
  "version": 1,
  "pr": { "repo": "acme/widgets", "number": 382, "url": "https://github.com/acme/widgets/pull/382", "title": "Retry failed uploads" },
  "headSha": "4f1c2e9d0a7b3c5e6f8091a2b3c4d5e6f7a8b9c0",
  "at": "2026-11-12T09:00:00Z",
  "size": "M",
  "minutes": 20,
  "recommendation": "claude",
  "areas": [{ "label": "upload retry", "risk": "high" }, { "label": "tests", "risk": "low" }],
  "why": "Changes how failed uploads are retried, with new tests; worth Claude's review before yours."
}
```

## Left to the builder

- Wording of tooltips and group headings within the above.
- How the skill reads a very large diff (sampling, file list only).
