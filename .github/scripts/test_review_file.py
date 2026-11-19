import copy
import json
import pathlib
import re
import sys
import tempfile
import unittest

SKILL = pathlib.Path(__file__).resolve().parents[2] / "skills" / "give-pr-review"
sys.path.insert(0, str(SKILL / "scripts"))

import check_review_file as check  # noqa: E402


def examples():
    """The findings.json and decisions.json examples of review-file.md, in order."""
    text = (SKILL / "references" / "review-file.md").read_text()
    return [json.loads(block) for block in re.findall(r"```json\n(.*?)```", text, re.S)]


class ReviewFileTest(unittest.TestCase):
    def setUp(self):
        self.findings, self.decisions, self.follow_up, self.follow_up_decision = examples()

    def folder(self, findings, decisions=None):
        d = tempfile.TemporaryDirectory()
        self.addCleanup(d.cleanup)
        (pathlib.Path(d.name) / "findings.json").write_text(json.dumps(findings))
        if decisions is not None:
            (pathlib.Path(d.name) / "decisions.json").write_text(json.dumps(decisions))
        return d.name

    def finding(self, **change):
        data = copy.deepcopy(self.findings)
        data["findings"][0].update(change)
        return data

    def test_the_documented_examples_pass(self):
        self.assertEqual(check.problems(self.folder(self.findings, self.decisions)), [])

    def test_decisions_are_optional(self):
        self.assertEqual(check.problems(self.folder(self.findings)), [])

    def test_a_missing_findings_file_is_reported(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertTrue(check.problems(d)[0].startswith("findings.json:"))

    def test_an_unknown_severity_is_reported(self):
        self.assertIn("severity", " ".join(check.problems(self.folder(self.finding(severity="critical")))))

    def test_a_newer_version_is_refused(self):
        data = copy.deepcopy(self.findings)
        data["version"] = 2
        self.assertIn("findings.json: version must be 1", check.problems(self.folder(data)))

    def test_ids_must_be_unique(self):
        data = copy.deepcopy(self.findings)
        data["findings"].append(copy.deepcopy(data["findings"][0]))
        self.assertTrue(any("used twice" in p for p in check.problems(self.folder(data))))

    def test_ids_must_be_slugs(self):
        self.assertTrue(any("slug" in p for p in check.problems(self.folder(self.finding(id="Retry loop")))))

    def test_a_comment_on_the_whole_pull_request_has_no_line(self):
        whole = self.finding(path=None, line=None, startLine=None, side=None)
        self.assertEqual(check.problems(self.folder(whole)), [])
        self.assertTrue(any("needs a path" in p for p in check.problems(self.folder(self.finding(path=None)))))

    def test_a_range_starts_before_its_last_line(self):
        self.assertTrue(any("startLine" in p for p in check.problems(self.folder(self.finding(startLine=42)))))

    def test_a_posted_finding_needs_its_thread(self):
        self.assertTrue(any("needs its thread" in p for p in check.problems(self.folder(self.finding(status="posted")))))
        posted = self.finding(status="posted", thread={"url": "https://github.com/o/r/pull/1#discussion_r1", "commentId": 1})
        self.assertEqual(check.problems(self.folder(posted)), [])

    def test_a_reply_names_the_note_it_answers(self):
        self.assertEqual(check.problems(self.folder(self.finding(reply=None))), [])
        self.assertTrue(any("reply" in p for p in check.problems(self.folder(self.finding(reply={"note": "", "text": "Done.", "at": "T"})))))

    def test_talk_is_a_list_of_exchanges(self):
        self.assertEqual(check.problems(self.folder(self.finding(talk=[]))), [])
        self.assertTrue(any("talk" in p for p in check.problems(self.folder(self.finding(talk=[{"note": "why?"}])))))

    def own(self, **change):
        data = self.finding(**{"status": "tofix", "lens": "correctness", "draft": None, **change})
        data["kind"] = "self"
        return data

    def test_a_self_review_has_its_own_pills_and_free_lenses(self):
        self.assertEqual(check.problems(self.folder(self.own())), [])
        self.assertTrue(any("status" in p for p in check.problems(self.folder(self.own(status="topost")))))
        self.assertTrue(any("status" in p for p in check.problems(self.folder(self.finding(status="tofix")))))

    def test_a_self_review_explains_with_a_pr_note(self):
        self.assertTrue(any("PR note" in p for p in check.problems(self.folder(self.own(status="explain")))))
        self.assertEqual(check.problems(self.folder(self.own(status="explain", draft="The retry stays: uploads are idempotent."))), [])

    def test_a_fixed_finding_names_its_commit(self):
        self.assertTrue(any("commit" in p for p in check.problems(self.folder(self.own(status="fixedlocal")))))
        fixed = self.own(status="fixedlocal", commit={"sha": "a" * 40, "url": "https://github.com/acme/widgets/commit/" + "a" * 40})
        self.assertEqual(check.problems(self.folder(fixed)), [])

    def test_a_branch_self_review_has_no_pull_request(self):
        data = self.own()
        data["pr"] = None
        data["branch"] = {"repo": "acme/widgets", "name": "fix/retry", "base": "origin/main", "head": "b" * 40}
        self.assertEqual(check.problems(self.folder(data)), [])
        data["branch"] = {"repo": "acme/widgets", "name": "fix/retry"}
        self.assertTrue(any("branch must be" in p for p in check.problems(self.folder(data))))
        given = self.finding()
        given["pr"] = None
        self.assertTrue(any("pr must be" in p for p in check.problems(self.folder(given))))

    def reply(self, **change):
        data = self.finding(**{"status": "action", "lens": None, "severity": None, "certainty": None, "section": "code",
                               "reviewer": "octocat", "quote": "Why no backoff?", "draft": "done: <commit>",
                               "thread": {"url": "https://github.com/acme/widgets/pull/7#discussion_r1", "commentId": 1, "type": "review-comment"}, **change})
        data["kind"] = "reply"
        return data

    def test_a_reply_card_is_a_reviewer_thread(self):
        self.assertEqual(check.problems(self.folder(self.reply())), [])
        self.assertTrue(any("thread" in p for p in check.problems(self.folder(self.reply(thread=None)))))
        no_type = self.reply(thread={"url": "u", "commentId": 1})
        self.assertTrue(any("type" in p for p in check.problems(self.folder(no_type))))
        self.assertTrue(any("reviewer" in p for p in check.problems(self.folder(self.reply(reviewer=None)))))
        self.assertTrue(any("section" in p for p in check.problems(self.folder(self.reply(section="other")))))

    def test_every_reply_card_is_checked_as_one_whatever_the_first_card_holds(self):
        data = self.reply(reply=None)
        second = copy.deepcopy(data["findings"][0])
        second["id"] = "second"
        data["findings"].append(second)
        self.assertEqual(check.problems(self.folder(data)), [])

    def test_a_reply_card_has_its_own_pills(self):
        self.assertEqual(check.problems(self.folder(self.reply(status="none", draft=None))), [])
        self.assertTrue(any("status" in p for p in check.problems(self.folder(self.reply(status="topost")))))
        self.assertTrue(any("commit" in p for p in check.problems(self.folder(self.reply(status="fixedpushed")))))

    def test_an_unknown_kind_is_reported(self):
        data = self.finding()
        data["kind"] = "other"
        self.assertIn("kind must be give, self or reply", check.problems(self.folder(data)))

    def test_a_decision_for_an_unknown_finding_is_reported(self):
        data = copy.deepcopy(self.decisions)
        data["decisions"]["no-such-finding"] = data["decisions"].pop("retry-loop-never-backs-off")
        self.assertTrue(any("no finding has this id" in p for p in check.problems(self.folder(self.findings, data))))

    def test_an_edited_draft_needs_its_base(self):
        data = copy.deepcopy(self.decisions)
        data["decisions"]["retry-loop-never-backs-off"]["draftBase"] = None
        self.assertTrue(any("draftBase" in p for p in check.problems(self.folder(self.findings, data))))

    def test_a_comment_in_a_draft_review_is_marked_true_or_false(self):
        data = copy.deepcopy(self.decisions)
        posted = next(d for d in data["decisions"].values() if d.get("posted"))["posted"]
        posted["draft"] = True
        self.assertEqual(check.problems(self.folder(self.findings, data)), [])
        posted["draft"] = "yes"
        self.assertTrue(any("posted.draft" in p for p in check.problems(self.folder(self.findings, data))))

    def test_an_unknown_decision_is_reported(self):
        data = copy.deepcopy(self.decisions)
        data["decisions"]["retry-loop-never-backs-off"]["decision"] = "maybe"
        self.assertTrue(any("agree, drop or null" in p for p in check.problems(self.folder(self.findings, data))))


    def threaded(self, **follow_up):
        return self.finding(status="recheck", thread={"url": "u", "commentId": 1}, followUp=dict(self.follow_up, **follow_up))

    def test_a_follow_up_passes(self):
        self.assertEqual(check.problems(self.folder(self.threaded())), [])

    def test_a_silent_ok_fix_has_an_empty_reply(self):
        self.assertEqual(check.problems(self.folder(self.threaded(did="fix", replies=[], draft="", drafts={"ok": "", "notok": "Still retries at once."}))), [])

    def test_follow_up_fields_are_checked(self):
        for change in ({"verdict": "maybe"}, {"did": "nothing"}, {"drafts": {"ok": "fair enough"}}, {"key": ""},
                       {"resolved": "no"}, {"replies": [{"url": "u"}]}, {"summary": ""}):
            self.assertTrue(check.problems(self.folder(self.threaded(**change))), change)

    def test_a_reply_may_name_who_wrote_it(self):
        reply = {"commentId": 5, "url": "u", "body": "Why not fork it?"}
        self.assertEqual(check.problems(self.folder(self.threaded(replies=[dict(reply, user="pat")]))), [])
        self.assertEqual(check.problems(self.folder(self.threaded(replies=[reply]))), [])
        self.assertTrue(check.problems(self.folder(self.threaded(replies=[dict(reply, user="")]))))

    def test_follow_up_needs_a_thread(self):
        self.assertIn("finding retry-loop-never-backs-off: a followUp needs the finding's thread",
                      check.problems(self.folder(self.finding(followUp=self.follow_up))))

    def test_only_a_give_review_has_follow_ups(self):
        data = self.threaded()
        data["kind"] = "self"
        self.assertIn("finding retry-loop-never-backs-off: only a give-pr-review finding has a followUp",
                      check.problems(self.folder(data)))

    def test_a_follow_up_decision_passes_and_is_checked(self):
        ok = copy.deepcopy(self.decisions)
        ok["decisions"]["retry-loop-never-backs-off"]["followUp"] = self.follow_up_decision
        self.assertEqual(check.problems(self.folder(self.findings, ok)), [])
        for change in ({"verdict": "yes"}, {"decision": "send"}, {"key": ""}, {"draft": "mine", "draftBase": None}, {"resolved": 3}):
            bad = copy.deepcopy(ok)
            bad["decisions"]["retry-loop-never-backs-off"]["followUp"].update(change)
            self.assertTrue(check.problems(self.folder(self.findings, bad)), change)


    def test_a_sent_follow_up_decision_has_a_time(self):
        ok = copy.deepcopy(self.decisions)
        ok["decisions"]["retry-loop-never-backs-off"]["followUp"] = dict(self.follow_up_decision, sent="2026-11-11T09:20:01Z")
        self.assertEqual(check.problems(self.folder(self.findings, ok)), [])
        ok["decisions"]["retry-loop-never-backs-off"]["followUp"]["sent"] = True
        self.assertTrue(check.problems(self.folder(self.findings, ok)))

    def test_a_follow_up_key_has_one_exact_form(self):
        for key in ("c12+c34+9f3a2b1", "c12", "9f3a2b1"):
            self.assertEqual(check.problems(self.folder(self.threaded(key=key))), [], key)
        for key in ("c34+c12", "c12 9f3a2b1", "12+9f3a2b1", "c12+9f3a2b1c", "c12+"):
            self.assertTrue(check.problems(self.folder(self.threaded(key=key))), key)


if __name__ == "__main__":
    unittest.main()
