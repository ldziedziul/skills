#!/usr/bin/env python3
"""Check a pr-triage triage.json against references/triage-file.md.

Prints each problem and exits 1 if any.

  python3 check_triage_file.py <triage.json>
"""
import json
import re
import sys

VERSION = 1
SIZES = {"S", "M", "L", "XL"}
RECOMMENDATIONS = {"quick", "claude", "deep"}
RISKS = {"low", "medium", "high"}
SHA = re.compile(r"^[0-9a-f]{40}$")
WHEN = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?Z$")
REPO = re.compile(r"^[^/\s]+/[^/\s]+$")


def _str(v):
    return isinstance(v, str) and v.strip() != ""


def _int(v):
    return isinstance(v, int) and not isinstance(v, bool) and v > 0


def _doc(d):
    """A document counted in docsMinutes: {path, url, sections?}, or an older file's path string."""
    if isinstance(d, str):
        return _str(d)
    return (isinstance(d, dict) and _str(d.get("path")) and _str(d.get("url"))
            and (d.get("sections") is None or isinstance(d.get("sections"), str)))


def problems(path):
    try:
        with open(path) as f:
            data = json.load(f)
    except (OSError, ValueError) as e:
        return [f"{path}: {e}"]
    if not isinstance(data, dict):
        return ["triage.json: not an object"]
    found = []
    if data.get("version") != VERSION:
        found.append(f"version must be {VERSION}")
    pr = data.get("pr")
    if not (isinstance(pr, dict) and isinstance(pr.get("repo"), str) and REPO.match(pr["repo"])
            and _int(pr.get("number")) and _str(pr.get("url")) and _str(pr.get("title"))):
        found.append("pr must be {repo: owner/repo, number, url, title}")
    if not (isinstance(data.get("headSha"), str) and SHA.match(data["headSha"])):
        found.append("headSha must be a full commit SHA")
    if not (isinstance(data.get("at"), str) and WHEN.match(data["at"])):
        found.append("at must be an ISO 8601 time in UTC")
    if data.get("size") not in SIZES:
        found.append("size must be S, M, L or XL")
    if not _int(data.get("minutes")):
        found.append("minutes must be a positive whole number")
    if "docsMinutes" in data and not _int(data["docsMinutes"]):
        found.append("docsMinutes must be a positive whole number")
    if "descriptionMinutes" in data and not _int(data["descriptionMinutes"]):
        found.append("descriptionMinutes must be a positive whole number")
    if "specMinutes" in data:
        if not _int(data["specMinutes"]):
            found.append("specMinutes must be a positive whole number")
        elif _int(data.get("docsMinutes")) and data["specMinutes"] > data["docsMinutes"]:
            found.append("specMinutes can't be more than docsMinutes")
        elif _int(data.get("descriptionMinutes")) and data["specMinutes"] < data["descriptionMinutes"]:
            found.append("specMinutes can't be less than descriptionMinutes")
    if "docs" in data and not (isinstance(data["docs"], list) and all(_doc(d) for d in data["docs"])):
        found.append("docs must be a list of {path, sections, url} (or, from older files, paths)")
    if data.get("recommendation") not in RECOMMENDATIONS:
        found.append("recommendation must be quick, claude or deep")
    areas = data.get("areas")
    if not (isinstance(areas, list) and areas and all(isinstance(a, dict) and _str(a.get("label")) and a.get("risk") in RISKS for a in areas)):
        found.append("areas must be a non-empty list of {label, risk: low, medium or high}")
    if not _str(data.get("why")):
        found.append("why is missing")
    return found


def main(argv):
    if len(argv) != 2:
        print(__doc__.strip().split("\n\n")[-1].strip())
        return 2
    found = problems(argv[1])
    for line in found:
        print(line)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
