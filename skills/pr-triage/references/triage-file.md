# The triage file

One file per pull request, beside give-pr-review's review files, so the
Herdr pull requests panel can show it on the list:

```
${XDG_STATE_HOME:-~/.local/state}/pr-reviews/<owner>/<repo>/<number>/triage.json
```

Only pr-triage writes it, whole and atomically: to `triage.json.tmp` in
the same folder, then renamed over `triage.json`.
`scripts/check_triage_file.py <file>` checks it against this page.

```json
{
  "version": 1,
  "pr": { "repo": "acme/widgets", "number": 382, "url": "https://github.com/acme/widgets/pull/382", "title": "Retry failed uploads" },
  "headSha": "4f1c2e9d0a7b3c5e6f8091a2b3c4d5e6f7a8b9c0",
  "at": "2026-11-12T09:00:00Z",
  "size": "M",
  "minutes": 20,
  "docsMinutes": 6,
  "specMinutes": 4,
  "descriptionMinutes": 2,
  "docs": [
    { "path": "docs/design/upload-retry.md", "sections": "§3, §4", "url": "https://github.com/acme/widgets/blob/main/docs/design/upload-retry.md" },
    { "path": "docs/specs/2026-11-10-upload-retry.md", "sections": "UR-1, UR-4", "url": "https://github.com/acme/widgets/blob/main/docs/specs/2026-11-10-upload-retry.md" }
  ],
  "recommendation": "claude",
  "areas": [{ "label": "upload retry", "risk": "high" }, { "label": "tests", "risk": "low" }],
  "why": "Changes how failed uploads are retried, with new tests; worth Claude's review before yours."
}
```

- `version` - 1. A reader that sees a higher one ignores the file.
- `pr` - the pull request: `repo` as `owner/repo`, `number`, `url`, `title`.
- `headSha` - the head commit assessed. The panel shows an assessment of
  an older head as old.
- `at` - when it was written, ISO 8601 in UTC.
- `size` - `S`, `M`, `L` or `XL`: up to 300 lines and 6 files, 1200 and
  20, 3500 and 50, or more; the larger of the two decides (scaled so
  merged pull requests split about 25 / 30 / 30 / 15 %). Lockfiles and
  generated files don't count.
- `minutes` - how long a careful read by the user would take, a positive
  whole number.
- `docsMinutes` - how long reading only the pull request's description and
  the spec and design it is judged against would take the user, without
  the code: the documents it adds or changes, and the ones (or their
  sections) its description points to, at about 130 words a minute,
  rounded up, at least 1. Older files may not have it: a reader falls back
  to `minutes`.
- `specMinutes` - the description and the spec without the design, part
  of `docsMinutes`: the documents and sections counted there minus the
  design ones, rounded up, at least 1; `descriptionMinutes` when there is
  no spec. The panel leads with it. Older files may not have it.
- `descriptionMinutes` - the description alone, part of `docsMinutes`: the
  read when the user skips the spec and design. Its words at about 200 a
  minute, rounded up, at least 1. Older files may not have it.
- `docs` - the documents counted in `docsMinutes`, `[]` when there are
  none: `{ path, sections, url }`, `sections` the parts counted ("§3, §4",
  requirement ids) or null for the whole file, and `url` a link that opens
  it where it was read - the pull request's head for a document it
  changes, else the branch it was found on (a stacked pull request's spec
  may be only on the default branch). Older files list plain paths.
- `recommendation` - `quick` (read it yourself, it's small and plain),
  `claude` (run give-pr-review first, then read its cards) or `deep` (needs
  the user's full attention: a contract or API change, concurrency, data
  migration, security, or a design call).
- `areas` - what it touches, riskiest first: `{ label, risk }`, `risk`
  `low`, `medium` or `high`; at least one.
- `why` - one plain sentence: what the change is and why that
  recommendation.
