import copy
import json
import pathlib
import re
import sys
import tempfile
import unittest

SKILL = pathlib.Path(__file__).resolve().parents[2] / "skills" / "pr-triage"
sys.path.insert(0, str(SKILL / "scripts"))

import check_triage_file as check  # noqa: E402


def example():
    text = (SKILL / "references" / "triage-file.md").read_text()
    return json.loads(re.findall(r"```json\n(.*?)```", text, re.S)[0])


class TriageFileTest(unittest.TestCase):
    def file(self, data):
        d = tempfile.TemporaryDirectory()
        self.addCleanup(d.cleanup)
        path = pathlib.Path(d.name) / "triage.json"
        path.write_text(data if isinstance(data, str) else json.dumps(data))
        return str(path)

    def changed(self, **change):
        data = copy.deepcopy(example())
        data.update(change)
        return check.problems(self.file(data))

    def test_the_documented_example_passes(self):
        self.assertEqual(check.problems(self.file(example())), [])

    def test_broken_json_is_reported(self):
        self.assertTrue(check.problems(self.file("{")))

    def test_values_are_checked(self):
        for change in ({"version": 2}, {"size": "XXL"}, {"minutes": 0}, {"minutes": "5"}, {"recommendation": "maybe"},
                       {"areas": []}, {"areas": [{"label": "x", "risk": "huge"}]}, {"why": ""}, {"headSha": "abc"},
                       {"pr": {"repo": "acme", "number": 1, "url": "u", "title": "t"}}, {"at": "yesterday"}):
            self.assertTrue(self.changed(**change), change)

    def test_every_recommendation_is_allowed(self):
        for rec in ("quick", "claude", "deep"):
            self.assertEqual(self.changed(recommendation=rec), [], rec)


    def test_docs_minutes_and_docs_are_checked(self):
        self.assertEqual(self.changed(docsMinutes=4, docs=[]), [])
        for change in ({"docsMinutes": 0}, {"docsMinutes": "3"}, {"docs": "docs/a.md"}, {"docs": [""]}):
            self.assertTrue(self.changed(**change), change)

    def test_an_assessment_without_docs_minutes_still_passes(self):
        data = copy.deepcopy(example())
        del data["docsMinutes"], data["docs"]
        self.assertEqual(check.problems(self.file(data)), [])


    def test_description_minutes_is_checked(self):
        self.assertEqual(self.changed(descriptionMinutes=2), [])
        for bad in (0, "2", 1.5):
            self.assertTrue(self.changed(descriptionMinutes=bad), bad)

    def test_spec_minutes_lies_between_the_description_and_docs_minutes(self):
        self.assertEqual(self.changed(specMinutes=2), [])
        self.assertEqual(self.changed(specMinutes=6), [])
        for bad in (0, "4", 1.5, 1, 7):
            self.assertTrue(self.changed(specMinutes=bad), bad)


    def test_a_doc_names_its_link_and_sections(self):
        doc = {"path": "docs/specs/a-design.md", "sections": "§7, §9", "url": "https://github.com/acme/widgets/blob/main/docs/specs/a-design.md"}
        self.assertEqual(self.changed(docs=[doc, "docs/old-style.md"]), [])
        for bad in ({"path": "", "url": "u"}, {"path": "a.md"}, {"path": "a.md", "url": "u", "sections": 3}):
            self.assertTrue(self.changed(docs=[bad]), bad)


if __name__ == "__main__":
    unittest.main()
