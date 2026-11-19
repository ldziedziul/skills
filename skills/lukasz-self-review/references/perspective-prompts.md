# Perspective prompts for general-purpose agents

Two perspectives have no pr-review-toolkit agent. Dispatch a
`general-purpose` agent with the prompt below, prefixed by the shared
input every perspective gets (repo path, diff range, head SHA, survey
areas, "read the code at the head, not commit messages or the PR body")
and followed by the FINDING output shape from SKILL.md section 3.

## Spec and description conformance

You are reviewing a change against what it claims to do. Read, in this
order: the PR description (or the branch's commit messages when there is
no PR), any spec or design document the diff adds or edits under
`docs/specs` or similar, the repository's contribution rules (`AGENTS.md`,
`CLAUDE.md`, `docs/context/*.md`), then the diff itself.

Report only findings of these kinds:

- The description or spec promises behavior the code does not have, or
  the code does something the description does not mention and a
  reviewer would want to know.
- A spec or design statement that the code contradicts (a data structure,
  a bucket count, a label set, a lifecycle) - quote both sides.
- A repository rule the diff breaks (merged specs edited in place,
  missing unit test for a new production class, javadoc where the rules
  forbid it, formatting not applied) - name the rule and where it is
  written.
- A requirements or status document the diff flips without the evidence
  the document's own convention requires.

Do not restate what the diff does. Do not report style. Prefer the
finding that would change what the author writes in the description over
the one that would change a comment.

## Security and operations

You are reviewing a change for what happens when it runs in someone
else's environment, at 3 a.m., without its author. Read the diff with
these questions:

- Secrets and credentials: anything committed, logged, echoed in CI, or
  read from a place that is world-readable.
- Supply chain: downloads at build or start time without a pinned
  version and checksum; third-party GitHub Actions not pinned to a SHA;
  new dependencies with a wider permission or network footprint than the
  change needs.
- Startup and failure modes: a step that fails the whole system when a
  network resource is unavailable where it previously did not; a retry or
  timeout that is missing or unbounded; a `depends_on` or health check
  that turns an optional component into a hard dependency.
- Resource lifecycle: things opened and not closed, registered and not
  unregistered, counters or gauges that can drift and never recover,
  threads or connections held after their owner is gone.
- Operability: when this fails, does the log line carry the values that
  matter (which key, which backend, which connection), or only a step
  name? Are the metric or log names spelled the same everywhere they
  appear (code, dashboard, docs)?
- Scripts: quoting and empty-variable bugs, `set -e` with pipelines,
  commands whose output is used but never produced.

Report only what you can point to in the diff with a line. Say what
breaks and under which condition. Skip anything already true on the base
branch unless the diff makes it worse.
