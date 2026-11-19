#!/usr/bin/env python3
"""Check a give-pr-review review folder against references/review-file.md.

Checks findings.json and, when there is one, decisions.json: required
fields, allowed values, unique finding ids, and decisions only for
findings that exist. Prints each problem and exits 1 if any.

  python3 check_review_file.py <folder>
"""
import json
import pathlib
import re
import sys

VERSION = 1
SEVERITIES = {"major", "minor", "nit"}
CERTAINTIES = {"verified", "likely", "unsure"}
LENSES = {"bugs", "architecture", "maintainability"}
STATUSES = {"topost", "skipped", "posted", "recheck", "addressed", "stale"}
SELF_STATUSES = {"tofix", "explain", "stale", "fixedlocal", "fixedpushed", "explained", "dropped"}
REPLY_STATUSES = {"action", "fixedlocal", "fixedpushed", "replied", "none", "dropped"}
SECTIONS = {"code", "docs", "answer", "decision"}
THREAD_TYPES = {"review-comment", "review", "issue-comment"}
KINDS = {None, "give", "self", "reply"}
SIDES = {"RIGHT", "LEFT"}
DECISIONS = {"agree", "drop", None}
DID = {"fix", "reply", "both"}
VERDICTS = {"ok", "notok"}
SHA = re.compile(r"^[0-9a-f]{40}$")
KEY = re.compile(r"^(c\d+(\+c\d+)*(\+[0-9a-f]{7})?|[0-9a-f]{7})$")
WHEN = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?Z$")
ID = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def _str(v):
    return isinstance(v, str) and v.strip() != ""


def _int(v):
    return isinstance(v, int) and not isinstance(v, bool) and v > 0


def _key(key):
    """A follow-up key as review-file.md fixes it: c<id>+c<id>... ascending, then +<sha7>; or only either."""
    if not (isinstance(key, str) and KEY.match(key)):
        return False
    ids = [int(p[1:]) for p in key.split("+") if p.startswith("c")]
    return ids == sorted(set(ids))


def _follow_up(fu):
    """What's wrong with a finding's followUp, as review-file.md's Follow-ups section has it."""
    found = []
    if not _key(fu.get("key")):
        found.append("followUp.key must be c<id> per author reply, ids ascending, then the commit's 7-character SHA, joined by +")
    if fu.get("did") not in DID:
        found.append(f"followUp.did must be one of {', '.join(sorted(DID))}")
    commit = fu.get("commit")
    if commit is not None and not (isinstance(commit, dict) and _str(commit.get("sha")) and _str(commit.get("url"))):
        found.append("followUp.commit must be {sha, url} or null")
    replies = fu.get("replies")
    if not (isinstance(replies, list) and all(isinstance(r, dict) and _int(r.get("commentId")) and _str(r.get("url")) and isinstance(r.get("body"), str)
                                                    and (r.get("user") is None or _str(r.get("user"))) for r in replies)):
        found.append("followUp.replies must be a list of {commentId, url, body, user}")
    for key in ("summary", "why", "at"):
        if not _str(fu.get(key)):
            found.append(f"followUp.{key} is missing")
    if fu.get("verdict") not in VERDICTS:
        found.append("followUp.verdict must be ok or notok")
    drafts = fu.get("drafts")
    if not isinstance(fu.get("draft"), str) or not (isinstance(drafts, dict) and all(isinstance(drafts.get(v), str) for v in VERDICTS)):
        found.append("followUp needs a draft and drafts {ok, notok}, text (an ok silent fix's may be empty)")
    if fu.get("threadId") is not None and not _str(fu.get("threadId")):
        found.append("followUp.threadId must be text or null")
    if not isinstance(fu.get("resolved"), bool):
        found.append("followUp.resolved must be true or false")
    return found


def _follow_up_decision(d):
    """What's wrong with a decision's followUp."""
    found = []
    if not _str(d.get("key")):
        found.append("followUp.key is missing")
    if d.get("decision") not in DECISIONS:
        found.append("followUp.decision must be agree, drop or null")
    if d.get("verdict") not in VERDICTS | {None}:
        found.append("followUp.verdict must be ok, notok or null")
    if d.get("draft") is not None and not isinstance(d.get("draft"), str):
        found.append("followUp.draft must be text or null")
    if d.get("draft") is not None and not isinstance(d.get("draftBase"), str):
        found.append("followUp: an edited draft needs the draftBase it was made on")
    posted = d.get("posted")
    if posted is not None and not (isinstance(posted, dict) and _int(posted.get("commentId")) and _str(posted.get("url")) and _str(posted.get("at"))):
        found.append("followUp.posted must be {commentId, url, at} or null")
    if d.get("resolved") is not None and not _str(d.get("resolved")):
        found.append("followUp.resolved must be a time or null")
    if d.get("sent") is not None and not _str(d.get("sent")):
        found.append("followUp.sent must be a time or null")
    if not _str(d.get("at")):
        found.append("followUp.at is missing")
    return found


def check_findings(data):
    found = []
    if not isinstance(data, dict):
        return ["findings.json: not an object"]
    if data.get("version") != VERSION:
        found.append(f"findings.json: version must be {VERSION}")
    if data.get("kind") not in KINDS:
        found.append("kind must be give, self or reply")
    own = data.get("kind") == "self"
    answering = data.get("kind") == "reply"
    pr, branch = data.get("pr"), data.get("branch")
    if own and pr is None and branch is not None:
        if not (isinstance(branch, dict) and _str(branch.get("repo")) and branch["repo"].count("/") == 1
                and _str(branch.get("name")) and _str(branch.get("base")) and isinstance(branch.get("head"), str) and SHA.match(branch["head"])):
            found.append("branch must be {repo, name, base, head}, head a full commit SHA")
    elif not isinstance(pr, dict):
        found.append("findings.json: pr must be an object, or null with a branch in a self-review")
    else:
        if not (_str(pr.get("repo")) and pr["repo"].count("/") == 1):
            found.append("pr.repo must be owner/name")
        if not _int(pr.get("number")):
            found.append("pr.number must be a positive integer")
        for key in ("url", "title", "author"):
            if not _str(pr.get(key)):
                found.append(f"pr.{key} is missing")
    if not _str(data.get("reviewer")):
        found.append("reviewer is missing")
    if not (isinstance(data.get("headSha"), str) and SHA.match(data["headSha"])):
        found.append("headSha must be a full 40-character commit SHA")
    if not (isinstance(data.get("updatedAt"), str) and WHEN.match(data["updatedAt"])):
        found.append("updatedAt must be ISO 8601 in UTC, ending in Z")
    if not (isinstance(data.get("sources"), list) and all(_str(s) for s in data["sources"])):
        found.append("sources must be a list of names")
    if data.get("report") is not None and not _str(data.get("report")):
        found.append("report must be a URL or null")
    findings = data.get("findings")
    if not isinstance(findings, list):
        return found + ["findings must be a list"]
    seen = set()
    for n, f in enumerate(findings):
        where = f"findings[{n}]"
        if not isinstance(f, dict):
            found.append(f"{where}: not an object")
            continue
        fid = f.get("id")
        if not (isinstance(fid, str) and ID.match(fid)):
            found.append(f"{where}: id must be a lowercase slug")
        elif fid in seen:
            found.append(f"{where}: id {fid} is used twice")
        else:
            seen.add(fid)
            where = f"finding {fid}"
        for key in ("title", "verdict") if own or answering else ("title", "verdict", "draft"):
            if not _str(f.get(key)):
                found.append(f"{where}: {key} is missing")
        if own and f.get("draft") is not None and not _str(f.get("draft")):
            found.append(f"{where}: draft must be a PR note or null")
        if own and f.get("status") == "explain" and not _str(f.get("draft")):
            found.append(f"{where}: an explain finding needs its PR note in draft")
        if answering:
            checks = (("severity", SEVERITIES | {None}), ("certainty", CERTAINTIES | {None}), ("status", REPLY_STATUSES), ("section", SECTIONS))
            for key in ("reviewer", "quote"):
                if not _str(f.get(key)):
                    found.append(f"{where}: {key} is missing")
            if f.get("draft") is not None and not _str(f.get("draft")):
                found.append(f"{where}: draft must be a reply or null")
            if not isinstance(f.get("replyMissing", False), bool):
                found.append(f"{where}: replyMissing must be true or false")
        else:
            checks = (("severity", SEVERITIES), ("certainty", CERTAINTIES), ("status", SELF_STATUSES if own else STATUSES))
        for key, allowed in checks if own or answering else checks + (("lens", LENSES),):
            if f.get(key) not in allowed:
                found.append(f"{where}: {key} must be one of {', '.join(sorted(allowed))}")
        if own and not _str(f.get("lens")):
            found.append(f"{where}: lens must name the perspective")
        commit = f.get("commit")
        if commit is not None and not (isinstance(commit, dict) and _str(commit.get("sha")) and _str(commit.get("url"))):
            found.append(f"{where}: commit must be {{sha, url}} or null")
        if (own or answering) and f.get("status") in ("fixedlocal", "fixedpushed") and commit is None:
            found.append(f"{where}: a fixed finding needs its commit")
        path, line, start = f.get("path"), f.get("line"), f.get("startLine")
        if path is None:
            if line is not None or start is not None:
                found.append(f"{where}: a line needs a path")
        else:
            if not _str(path):
                found.append(f"{where}: path must be a file or null")
            if not _int(line):
                found.append(f"{where}: line must be a positive integer")
            if f.get("side") not in SIDES:
                found.append(f"{where}: side must be RIGHT or LEFT")
        if start is not None and not (_int(start) and _int(line) and start < line):
            found.append(f"{where}: startLine must be before line, or null")
        if not _str(f.get("link")):
            found.append(f"{where}: link is missing")
        snippet = f.get("snippet")
        if snippet is not None and not (isinstance(snippet, dict) and isinstance(snippet.get("lang"), str) and _str(snippet.get("code"))):
            found.append(f"{where}: snippet must be {{lang, code}} or null")
        if f.get("suggestion") is not None and not _str(f.get("suggestion")):
            found.append(f"{where}: suggestion must be a diff or null")
        if not (isinstance(f.get("labels"), list) and all(_str(l) for l in f["labels"])):
            found.append(f"{where}: labels must be a list of names")
        thread = f.get("thread")
        if thread is not None and not (isinstance(thread, dict) and _str(thread.get("url")) and _int(thread.get("commentId"))):
            found.append(f"{where}: thread must be {{url, commentId}} or null")
        if answering and not (isinstance(thread, dict) and thread.get("type") in THREAD_TYPES):
            found.append(f"{where}: a reply card needs its thread, with a type of {', '.join(sorted(THREAD_TYPES))}")
        if not own and not answering and f.get("status") in ("posted", "recheck", "addressed") and thread is None:
            found.append(f"{where}: a {f.get('status')} finding needs its thread")
        if not answering and not (isinstance(f.get("checkedAt"), str) and SHA.match(f["checkedAt"])):
            found.append(f"{where}: checkedAt must be a full commit SHA")
        reply = f.get("reply")
        if reply is not None and not (isinstance(reply, dict) and _str(reply.get("note")) and _str(reply.get("text")) and _str(reply.get("at"))):
            found.append(f"{where}: reply must be {{note, text, at}} or null")
        talk = f.get("talk", [])
        if not (isinstance(talk, list) and all(isinstance(x, dict) and _str(x.get("note")) and _str(x.get("text")) and _str(x.get("at")) for x in talk)):
            found.append(f"{where}: talk must be a list of {{note, text, at}}")
        follow_up = f.get("followUp")
        if follow_up is not None:
            if own or answering:
                found.append(f"{where}: only a give-pr-review finding has a followUp")
            if not isinstance(follow_up, dict):
                found.append(f"{where}: followUp must be an object or null")
            else:
                if thread is None:
                    found.append(f"{where}: a followUp needs the finding's thread")
                found += [f"{where}: {p}" for p in _follow_up(follow_up)]
        history = f.get("history")
        if not (isinstance(history, list) and all(isinstance(h, dict) and _str(h.get("at")) and _str(h.get("note")) for h in history)):
            found.append(f"{where}: history must be a list of {{at, note}}")
    unmatched = data.get("unmatched")
    if not (isinstance(unmatched, list) and all(isinstance(u, dict) and _str(u.get("url")) and isinstance(u.get("body"), str) for u in unmatched)):
        found.append("unmatched must be a list of {url, body, note}")
    return found


def check_decisions(data, ids):
    found = []
    if not isinstance(data, dict):
        return ["decisions.json: not an object"]
    if data.get("version") != VERSION:
        found.append(f"decisions.json: version must be {VERSION}")
    decisions = data.get("decisions")
    if not isinstance(decisions, dict):
        return found + ["decisions must be an object keyed by finding id"]
    for fid, d in decisions.items():
        where = f"decision {fid}"
        if fid not in ids:
            found.append(f"{where}: no finding has this id")
        if not isinstance(d, dict):
            found.append(f"{where}: not an object")
            continue
        if d.get("decision") not in DECISIONS:
            found.append(f"{where}: decision must be agree, drop or null")
        if d.get("draft") is not None and not _str(d.get("draft")):
            found.append(f"{where}: draft must be text or null")
        if d.get("draft") is not None and not _str(d.get("draftBase")):
            found.append(f"{where}: an edited draft needs the draftBase it was made on")
        if not isinstance(d.get("note", ""), str):
            found.append(f"{where}: note must be text")
        posted = d.get("posted")
        if posted is not None and not (isinstance(posted, dict) and _int(posted.get("commentId")) and _str(posted.get("url")) and _str(posted.get("at"))):
            found.append(f"{where}: posted must be {{commentId, url, at}} or null")
        if isinstance(posted, dict) and not isinstance(posted.get("draft", False), bool):
            found.append(f"{where}: posted.draft must be true or false")
        if not _str(d.get("at")):
            found.append(f"{where}: at is missing")
        follow_up = d.get("followUp")
        if follow_up is not None:
            if not isinstance(follow_up, dict):
                found.append(f"{where}: followUp must be an object or null")
            else:
                found += [f"{where}: {p}" for p in _follow_up_decision(follow_up)]
    return found


def problems(folder):
    folder = pathlib.Path(folder)
    try:
        findings = json.loads((folder / "findings.json").read_text())
    except (OSError, ValueError) as e:
        return [f"findings.json: {e}"]
    found = check_findings(findings)
    path = folder / "decisions.json"
    if path.exists():
        ids = {f.get("id") for f in findings.get("findings", []) if isinstance(f, dict)} if isinstance(findings, dict) else set()
        try:
            found += check_decisions(json.loads(path.read_text()), ids)
        except ValueError as e:
            found.append(f"decisions.json: {e}")
    return found


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__.strip())
    found = problems(sys.argv[1])
    for p in found:
        print(p)
    sys.exit(1 if found else 0)
