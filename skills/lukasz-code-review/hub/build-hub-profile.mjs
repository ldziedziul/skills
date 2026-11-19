#!/usr/bin/env node
// Builds a claude-review-hub profile and post prompts from the
// lukasz-code-review skill, and writes them into a repo's .review-tool/config/.
// The skill stays the source of truth: edit SKILL.md, then rerun this.
//
//   node build-hub-profile.mjs <repo>      write into <repo>/.review-tool/config/
//   node build-hub-profile.mjs --print     print the profile and prompts as JSON

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROFILE_ID = "lukasz-style";

const here = path.dirname(fileURLToPath(import.meta.url));
export const defaultSkillPath = path.join(here, "..", "SKILL.md");

const SEVERITY = { major: "critical", minor: "warning", nit: "suggestion" };
const CONFIDENCE = { verified: 0.9, likely: 0.6, unsure: 0.3 };

/** Body of the first `## ` section whose heading starts with `prefix`. */
export function section(markdown, prefix) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## ${prefix}`));
  if (start < 0) throw new Error(`SKILL.md has no "## ${prefix}" section`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n").trim();
}

/** `- **Label.** text` bullets, with their indented continuation lines. */
export function checklist(body) {
  const items = [];
  for (const line of body.split("\n")) {
    const head = line.match(/^- \*\*(.+?)\.?\*\*\s*(.*)$/);
    if (head) items.push({ label: head[1], text: head[2] });
    else if (items.length && /^\s+\S/.test(line)) items.at(-1).text += ` ${line.trim()}`;
  }
  if (!items.length) throw new Error("Step 2 has no `- **Label.**` checklist bullets");
  return items;
}

/** Rows of a `| \`key\` | meaning |` table, keyed by the backticked name. */
export function tableRows(body, keys) {
  const rows = {};
  for (const match of body.matchAll(/^\| `(\w+)` \| (.+?) \|$/gm)) {
    if (keys.includes(match[1])) rows[match[1]] = match[2];
  }
  const missing = keys.filter((key) => !(key in rows));
  if (missing.length) throw new Error(`Step 4 tables are missing: ${missing.join(", ")}`);
  return rows;
}

function slug(label) {
  return label.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function buildProfile(markdown) {
  const items = checklist(section(markdown, "Step 2"));
  const step4 = section(markdown, "Step 4");
  const severities = tableRows(step4, Object.keys(SEVERITY));
  const certainties = tableRows(step4, Object.keys(CONFIDENCE));

  const dimensions = items.map(({ label, text }) => ({
    id: slug(label),
    label,
    enabled: true,
    prompt: `${text} Cite the file and line, and say what you opened or ran to check it.`,
  }));
  dimensions.push({
    id: "other-defects",
    label: "Other defects",
    enabled: true,
    prompt:
      "The checklist is not exhaustive. Report any other wrong behaviour the diff introduces: a broken condition, an unhandled error path, a caller left on the old contract. Give the input or state that goes wrong.",
  });

  const context = [
    "Reviewed the way Lukasz reviews (generated from the lukasz-code-review skill).",
    "",
    "Severity:",
    ...Object.entries(SEVERITY).map(([name, hub]) => `- ${hub} = ${name}: ${severities[name]}`),
    "",
    "Confidence is set by what you actually checked, never by how serious the finding would be if true:",
    ...Object.entries(CONFIDENCE).map(([name, value]) => `- ${value} = ${name}: ${certainties[name]}`),
    "Put the unchecked premise of a likely or unsure finding in its detail.",
    "",
    "A suggested alternative includes a snippet or a link (library, doc, an existing file already doing it), never a vague 'consider doing this differently'.",
    "Drop speculative nitpicking a human reviewer would not bother to type. More than about 12 critical + warning findings is noise: keep only what matters.",
  ].join("\n");

  return {
    id: PROFILE_ID,
    name: "Lukasz-style review",
    dimensions,
    context,
    include: [],
    exclude: ["**/*.lock", "**/package-lock.json", "**/*.snap"],
    severityFloor: "suggestion",
    confidenceFloor: 0.3,
  };
}

const PENDING_REVIEW = [
  "## Post into a pending review, never a published comment",
  "Comments go into the reviewer's own PENDING (draft) review, which only they can see until they submit it in the GitHub UI.",
  "1. `gh api user --jq .login` for the reviewer, and `gh pr view <pr> --json headRefOid` for the head commit.",
  "2. `gh api repos/<owner>/<repo>/pulls/<pr>/reviews` and look for a review with `state` PENDING whose `user.login` is the reviewer.",
  '3. None: create one with `gh api repos/<owner>/<repo>/pulls/<pr>/reviews --input review.json`, where review.json is `{"commit_id": "<head>", "comments": [{"path": "<file>", "line": <n>, "side": "RIGHT", "body": "<text>"}]}`. No `event` field: that is what keeps it pending.',
  "4. One exists: add to it with the GraphQL mutation `addPullRequestReviewThread(input: {pullRequestReviewId: <its node_id>, path, line, side: RIGHT, body})`.",
  "5. Read the comment back with `gh api repos/<owner>/<repo>/pulls/<pr>/reviews/<review id>/comments` and check the body is what you meant to send.",
  "Never submit, approve or request changes, and never post with `pulls/<pr>/comments`: publishing stays the reviewer's decision.",
].join("\n");

export function buildPrompts(markdown) {
  const voice = `## Write the comment in Lukasz's voice\n${section(markdown, "Step 3")}`;
  return {
    "finding.post": [
      "Post finding {findingId} to its pull request with the {cli} CLI as the {skill} skill documents, then call `mcp__dashboard__mark_finding_posted` with the id of the review comment you created.",
      "",
      voice,
      "",
      PENDING_REVIEW,
      "{note}",
    ].join("\n"),
    "findings.post": [
      "# Post these findings to their pull request",
      "",
      "Post each one {with_cli}, then call `mcp__dashboard__mark_finding_posted` for it with the id of the review comment you created.",
      "",
      "{finding_list}",
      "",
      voice,
      "",
      PENDING_REVIEW,
      "{note}",
    ].join("\n"),
  };
}

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/** Replaces our profile and post prompts by id; everything else in the store is kept. */
export function install(repo, markdown) {
  const config = path.join(repo, ".review-tool", "config");
  const profilesFile = path.join(config, "profiles.json");
  const promptsFile = path.join(config, "prompts.json");

  const profile = buildProfile(markdown);
  const profiles = readJson(profilesFile, []).filter((item) => item?.id !== PROFILE_ID);
  writeJson(profilesFile, [...profiles, profile]);
  writeJson(promptsFile, { ...readJson(promptsFile, {}), ...buildPrompts(markdown) });
  return { profilesFile, promptsFile, dimensions: profile.dimensions.length };
}

function main(args) {
  const skillFlag = args.indexOf("--skill");
  const skillPath = skillFlag >= 0 ? args[skillFlag + 1] : defaultSkillPath;
  const markdown = fs.readFileSync(skillPath, "utf8");

  if (args.includes("--print")) {
    console.log(JSON.stringify({ profile: buildProfile(markdown), prompts: buildPrompts(markdown) }, null, 2));
    return;
  }
  const repo = args.find((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--skill");
  if (!repo || !fs.existsSync(path.join(repo, ".git"))) {
    console.error("usage: build-hub-profile.mjs <git repo> [--skill SKILL.md] | --print");
    process.exit(1);
  }
  const result = install(path.resolve(repo), markdown);
  console.log(`profile "${PROFILE_ID}" (${result.dimensions} dimensions) -> ${result.profilesFile}`);
  console.log(`post prompts finding.post, findings.post -> ${result.promptsFile}`);
}

const invoked = process.argv[1] && fs.realpathSync(path.resolve(process.argv[1]));
if (invoked === fs.realpathSync(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
