# Claude Code skills

My custom [Claude Code](https://docs.claude.com/en/docs/claude-code) skills.
Each directory under `skills/` with a `SKILL.md` is one skill. The repo is
also a Claude Code plugin marketplace, so the skills install with the
built-in `/plugin` command.

## Skills

| Skill | What it does |
|---|---|
| [high-level-design-report](skills/high-level-design-report/) | High-level design overview of a PR, branch or module, as an HTML report with diagrams - no review. |
| [high-level-design-review](skills/high-level-design-review/) | Architecture and NFR write-up of a PR, branch or module, as an HTML report with diagrams. |
| [give-pr-review](skills/give-pr-review/) | Tracks a review you give on someone else's PR: verified findings with paste-ready comments and their status after each push. |
| [pr-triage](skills/pr-triage/) | Quickly assesses the PRs waiting for your review: size, risky areas, and whether to read it yourself, run Claude's review first or give it full attention. |
| [reply-to-pr-review](skills/reply-to-pr-review/) | Triages the review comments on your own PR, tracks fixes and replies per thread. |
| [multi-perspective-review](skills/multi-perspective-review/) | Reviews your own PR or branch from several perspectives before human review. |
| [lukasz-code-review](skills/lukasz-code-review/) | One-pass review in my own review voice; only when asked for by name. |
| [plain-english-writing](skills/plain-english-writing/) | Rules for prose people read: plain words, consequences over mechanisms. |

[_review-report-kit](skills/_review-report-kit/) is not a skill. It is the shared
source for the report pages of give-pr-review, reply-to-pr-review and
multi-perspective-review; see its README before changing any
`references/report-template.html`.

## Requirements

- `git`, `python3`, and the [`gh`](https://cli.github.com/) CLI signed in
  to GitHub, for every skill that works on pull requests.
- The HTML reports use the Artifact tool and the artifact-diagramming
  skill when the session has them. Without them, the design reports are
  written as local HTML files with inline SVG figures.
- Optional plugins, each replaced by a general-purpose agent when missing:
  `pr-review-toolkit` (multi-perspective-review's perspectives), `maister`
  (the maintainability pass of give-pr-review and high-level-design-review),
  `superpowers` (reply-to-pr-review's receiving-code-review discipline).
- give-pr-review, reply-to-pr-review, multi-perspective-review and pr-triage
  write a review file for the Herdr pull requests panel. Without the
  panel the file is still written; ask for "the report" to work from a
  page instead.

The skills are one bundle: several read files from their siblings
(`${CLAUDE_SKILL_DIR}/../`), so install the whole plugin rather than
copying a single skill.

## Install

In Claude Code:

```
/plugin marketplace add ldziedziul/skills
/plugin install lukasz@ldziedziul-skills
```

Skills installed this way are namespaced: `/lukasz:give-pr-review`.

To pick up every push to `main` automatically, turn on auto-update for the
marketplace: `/plugin` → Marketplaces → `ldziedziul-skills` → Enable
auto-update. Claude Code then updates the plugin when it starts. To update
straight away, run `/plugin marketplace update ldziedziul-skills`.

`plugin.json` has no `version` on purpose: Claude Code then treats each
commit as a new version. With a fixed version, a push that doesn't bump it
never reaches installed copies.

### While editing the skills

The plugin is installed as a cached copy, so local edits don't show up
until you push and update. To try edits straight away, start Claude Code
with the plugin loaded from your clone, for that session only:

```sh
claude --plugin-dir path/to/skills
```

If the installed plugin is enabled too, disable it in `/plugin` first so the
session uses your local copy.

## Test

CI ([.github/workflows/test.yml](.github/workflows/test.yml)) runs on every
push to `main` and on pull requests. To run the same checks locally:

```sh
# every skill has a SKILL.md with a matching name and a description
python3 .github/scripts/check_skills.py

# Python tests of the checkers
python3 -m unittest discover -s .github/scripts -p 'test_*.py'

# review report kit (jsdom from its lockfile)
(cd skills/_review-report-kit/tests && npm ci --ignore-scripts && node --test *.test.js)

# hub profile builder
node --test skills/lukasz-code-review/hub/*.test.mjs
```

## Security checks

[.github/workflows/security.yml](.github/workflows/security.yml) scans
every push and pull request: betterleaks over the whole history, TruffleHog
over the new commits (it also checks whether a found key still works),
and zizmor over the workflows. Its rules for betterleaks are in
`.betterleaks.toml`. To check each commit before it is made, run
`pre-commit install` once; the hook uses the same rules.

GitHub's own secret scanning and push protection are on as well.

## License

[MIT](LICENSE)
