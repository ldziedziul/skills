import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  PROFILE_ID,
  buildProfile,
  buildPrompts,
  checklist,
  defaultSkillPath,
  install,
  section,
} from "./build-hub-profile.mjs";

const skill = fs.readFileSync(defaultSkillPath, "utf8");

test("the real skill yields one dimension per checklist item plus the catch-all", () => {
  const items = checklist(section(skill, "Step 2"));
  const profile = buildProfile(skill);
  assert.ok(items.length >= 10, `only ${items.length} checklist items parsed`);
  assert.equal(profile.dimensions.length, items.length + 1);
  assert.equal(profile.dimensions[0].label, "Operational safety");
  assert.match(profile.dimensions[0].prompt, /CI\/CD workflow changes get particular scrutiny/);
});

test("continuation lines join the bullet they belong to", () => {
  const [first] = checklist("- **A thing.** first line\n  second line\n- **B.** other");
  assert.deepEqual(first, { label: "A thing", text: "first line second line" });
});

test("severity and certainty tables map onto hub severities and confidences", () => {
  const { context } = buildProfile(skill);
  assert.match(context, /- critical = major: Must change before merge/);
  assert.match(context, /- 0\.3 = unsure: Depends on code you could not see/);
});

test("post prompts carry the voice, keep the placeholders and stay pending", () => {
  const prompts = buildPrompts(skill);
  assert.match(prompts["finding.post"], /\{findingId\}.*\{cli\}.*\{skill\}/s);
  assert.match(prompts["findings.post"], /\{with_cli\}.*\{finding_list\}/s);
  for (const prompt of Object.values(prompts)) {
    assert.match(prompt, /Certainty decides the form/);
    assert.match(prompt, /No `event` field/);
    assert.match(prompt, /\{note\}/);
  }
});

test("a missing section fails loudly instead of building an empty profile", () => {
  assert.throws(() => buildProfile("# nothing here\n"), /no "## Step 2" section/);
});

test("install replaces only our profile and prompts", () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "hub-profile-"));
  const config = path.join(repo, ".review-tool", "config");
  fs.mkdirSync(config, { recursive: true });
  fs.writeFileSync(
    path.join(config, "profiles.json"),
    JSON.stringify([{ id: "bug-fix", name: "Bug fix" }, { id: PROFILE_ID, name: "stale" }]),
  );
  fs.writeFileSync(path.join(config, "prompts.json"), JSON.stringify({ "thread.reply": "mine" }));

  install(repo, skill);
  install(repo, skill);

  const profiles = JSON.parse(fs.readFileSync(path.join(config, "profiles.json"), "utf8"));
  assert.deepEqual(profiles.map((p) => p.id), ["bug-fix", PROFILE_ID]);
  assert.equal(profiles[1].name, "Lukasz-style review");
  const prompts = JSON.parse(fs.readFileSync(path.join(config, "prompts.json"), "utf8"));
  assert.deepEqual(Object.keys(prompts).sort(), ["finding.post", "findings.post", "thread.reply"]);
  fs.rmSync(repo, { recursive: true });
});
