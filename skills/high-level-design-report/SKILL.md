---
name: high-level-design-report
description: Explains the high-level design of a pull request, branch or module - components, flows and the choices that shape them - as an HTML report with diagrams, without judging it. Use when the user wants to understand or explain a design - "explain the design of PR N", "architecture overview with diagrams", "how is this module put together", "draw the components and flows of this change", "onboarding overview of this code".
---

# High-Level Design Report

## Overview

A published HTML page that lets a reader understand a change's design without reading the
whole diff: what the system is, how its parts connect, what path a request or run takes, and
which design choices shape it. The page describes; it does not assess. Every claim on the page
is checked against the code and links to it at one pinned commit.

When the user also wants the design judged (architecture, maintainability, modularization,
NFRs), use high-level-design-review instead; it builds on this skill.

**REQUIRED SUB-SKILLS:** plain-english-writing for all prose; artifact-diagramming for the
figures. Start the page with an Artifact `quickstart` (intent `other`), which carries the
page-design rules. Without the Artifact tool, write the page to a local HTML file and give
the user its path; without artifact-diagramming, draw the figures as inline SVG.

## 1. Pin the target and compute the facts

- Target: a PR (`gh pr view N`), a branch, or a path. Record the full head SHA; every link
  and number on the page refers to it.
- Read the code from a detached worktree, which creates no branch:
  `git fetch origin pull/N/head && git worktree add --detach <scratch>/wt FETCH_HEAD`
  (or `gh api` at the SHA). Never touch the user's checkout; `git worktree remove` at the end.
- Read the change's own design docs if it has any (ARCHITECTURE.md, spec, design), then the
  PR body. Where they state why a choice was made, quote that reason and say whose it is.
- Every number on the page comes from a command run in this session: module line counts
  (`wc -l`), the import or dependency graph (parse imports, e.g. Python `ast`, `grep import`
  for Java), test counts, files changed. A number you did not compute stays off the page or is
  labelled with its source ("PR author's figure").
- Check every edge, store and step you plan to draw against the code before drawing it.

## 2. Page contract

Sections, in this order:

1. **Header** - name, one-paragraph summary of what the change is, a row of fact tiles
   (computed numbers only).
2. **System context figure** - who talks to whom, labelled arrows, where state lives.
3. **Flow or lifecycle figure** - the path a request or run takes, including failure exits.
4. **Module map figure** - modules grouped by where they run, sizes, and every edge that
   crosses the change's boundary drawn distinctly. When the change sits in one module, map
   its classes and the edges into the neighbouring modules and libraries instead.
5. **Key design decisions** - table Decision / What it means in the code / Stated reason.
   The reason column quotes the docs, PR body or a code comment with its source, or says
   "not stated".
6. **Where to start reading** - table Entry point / What it does, one row per entry point
   (main, handlers, public API, config), each a permalink.
7. **Footer** - pinned SHA, sources, what was not checked.

Every sentence on the page says what the code does or why its author says it does it. Leave
out verdicts, concerns, suggestions and ratings; if the user asks for them, switch to
high-level-design-review and reuse what you computed here.

Every code reference is a permalink:
`https://github.com/{o}/{r}/blob/<full-sha>/<path>#L10-L20`.

Figures are hand-written inline SVG per artifact-diagramming; each figure's caption states
what it shows. See
[../high-level-design-review/references/example-design-review.html](../high-level-design-review/references/example-design-review.html)
for a finished page: adapt the header, sections 1 to 3 and the CSS, not the content, and
leave out its assessment sections.

## 3. Publish and hand off

- Before publishing, check every count on the page against its command output once (tile
  values, "N of M" phrases, table rows).
- Publish with the Artifact tool, then tell the user the link and, in plain English, the three
  or four things that matter most for understanding the design.
- Offer a high-level-design-review on the same SHA if the user wants the design judged.

## Common mistakes

| Mistake | Fix |
|---|---|
| `path:line` as plain text, or shortened paths (`.../Foo.java`) | Full permalink at the pinned SHA |
| Boxes named after components with unlabelled arrows | Draw the mechanism: labelled arrows, the boundary crossed, state stores |
| An edge drawn from the docs that the code does not have | Draw what the code does; note the gap in the footer |
| Counts typed from memory (and off by one) | Recompute from command output before publishing |
| "Well structured", "a weak spot", "should be split" | Describe the structure; judging it is high-level-design-review |
| A design reason invented to explain a choice | Quote the stated reason with its source, or write "not stated" |
| Code identifiers paraphrased into prose | Keep class, method and file names verbatim; plain words for the rest |
