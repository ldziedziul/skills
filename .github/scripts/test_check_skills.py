import pathlib
import tempfile
import unittest

from check_skills import front_matter, problems


def skill(root, name, text):
    d = root / name
    d.mkdir()
    if text is not None:
        (d / "SKILL.md").write_text(text)


class FrontMatterTest(unittest.TestCase):
    def test_folded_description(self):
        fields = front_matter("---\nname: a\ndescription: >\n  Use when\n  needed\n---\nbody")
        self.assertEqual(fields, {"name": "a", "description": "> Use when needed"})

    def test_unclosed_block(self):
        self.assertIsNone(front_matter("---\nname: a\n"))

    def test_missing_block(self):
        self.assertIsNone(front_matter("# Title\n"))


class ProblemsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_valid_skill_passes(self):
        skill(self.root, "good", "---\nname: good\ndescription: Use when X\n---\n")
        self.assertEqual(problems(self.root), [])

    def test_kits_and_hidden_dirs_are_skipped(self):
        skill(self.root, "_kit", None)
        skill(self.root, ".github", None)
        self.assertEqual(problems(self.root), [])

    def test_missing_skill_md(self):
        skill(self.root, "bare", None)
        self.assertEqual(problems(self.root), ["bare: no SKILL.md"])

    def test_name_mismatch(self):
        skill(self.root, "real", "---\nname: other\ndescription: d\n---\n")
        self.assertEqual(problems(self.root), ["real: name is 'other', expected 'real'"])

    def test_empty_description(self):
        skill(self.root, "s", "---\nname: s\ndescription: >\n---\n")
        self.assertEqual(problems(self.root), ["s: description is empty"])


if __name__ == "__main__":
    unittest.main()
