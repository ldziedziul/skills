#!/usr/bin/env python3
"""Check that every skill directory has a loadable SKILL.md.

A directory under skills/ is a skill unless its name starts with "_" (shared
kits) or "." (repo plumbing). Each skill needs a SKILL.md whose front
matter has a non-empty `description` and a `name` equal to the directory
name; Claude Code skips a skill that fails either.

  python3 .github/scripts/check_skills.py [skills-dir]
"""
import pathlib
import sys


def front_matter(text):
    """Top-level `key: value` pairs of the leading --- block, or None."""
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        return None
    fields, key = {}, None
    for line in lines[1:]:
        if line.strip() == "---":
            return fields
        if line[:1] not in (" ", "\t", "") and ":" in line:
            key, value = line.split(":", 1)
            key = key.strip()
            fields[key] = value.strip()
        elif key and line.strip():
            fields[key] = (fields[key] + " " + line.strip()).strip()
    return None


def problems(root):
    found = []
    for skill in sorted(p for p in root.iterdir() if p.is_dir()):
        if skill.name.startswith(("_", ".")):
            continue
        md = skill / "SKILL.md"
        if not md.is_file():
            found.append(f"{skill.name}: no SKILL.md")
            continue
        fields = front_matter(md.read_text())
        if fields is None:
            found.append(f"{skill.name}: SKILL.md has no front matter")
            continue
        name = fields.get("name", "").strip("'\"")
        if name != skill.name:
            found.append(f"{skill.name}: name is {name!r}, expected {skill.name!r}")
        description = fields.get("description", "")
        if description in ("", ">", ">-", "|", "|-"):
            found.append(f"{skill.name}: description is empty")
    return found


def main(argv):
    root = pathlib.Path(argv[1] if len(argv) > 1 else "skills").resolve()
    found = problems(root)
    for line in found:
        print(line)
    if not found:
        print("all skills ok")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
