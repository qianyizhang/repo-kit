from __future__ import annotations

import hashlib
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).parents[1] / "template" / "scripts" / "check_authoring.py"
SPEC = importlib.util.spec_from_file_location("check_authoring", SCRIPT)
assert SPEC and SPEC.loader
check_authoring = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = check_authoring
SPEC.loader.exec_module(check_authoring)


class AuthoringCheckTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "docs" / "glossary").mkdir(parents=True)
        (self.root / "records" / "work-items" / "items").mkdir(parents=True)
        (self.root / "records" / "reports").mkdir(parents=True)
        (self.root / "docs" / "glossary" / "ddd.md").write_text(
            """| Term | Meaning | _Avoid_ | ≠ (do not confuse) |
| --- | --- | --- | --- |
| `CanonicalTerm` | One meaning. | legacy term, shared alias | NeighborTerm |
| `OtherTerm` | Another meaning. | shared alias | CanonicalTerm |
""",
            encoding="utf-8",
        )
        self.item = self.root / "records" / "work-items" / "items" / "AB-X-001.md"
        self.item.write_text(
            """---
description: fixture
---
## Intent

Use the legacy term. Update the file and then run the test.

## Acceptance Criteria

The file should be updated. Run the test if the file changes.

## Context and Trade-offs

We need to preserve this excluded sentence.
""",
            encoding="utf-8",
        )
        (self.root / "CLAUDE.md").write_text(
            "更新文件，然后运行测试。\n最好记录结果。\n", encoding="utf-8"
        )
        (self.root / "records" / "reports" / "history.md").write_text(
            "Use the legacy term.\n", encoding="utf-8"
        )
        self._write_config(mode="advisory", blocking=())

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _write_config(self, *, mode: str, blocking: tuple[str, ...]) -> None:
        blocking_toml = ", ".join(f'"{value}"' for value in blocking)
        (self.root / "pyproject.toml").write_text(
            f"""[tool.authoring_check]
mode = "{mode}"
languages = ["en", "zh"]
glossary_globs = ["docs/glossary/*.md"]
blocking_rule_ids = [{blocking_toml}]

[[tool.authoring_check.targets]]
glob = "CLAUDE.md"
profile = "instruction"

[[tool.authoring_check.targets]]
glob = "records/work-items/items/*.md"
profile = "requirements"
sections = ["Intent", "Acceptance Criteria"]
""",
            encoding="utf-8",
        )

    def test_selected_surfaces_and_bilingual_rules(self) -> None:
        config = check_authoring.load_config(self.root)
        findings = check_authoring.check_repository(self.root, config)
        rule_ids = {finding.rule_id for finding in findings}
        self.assertTrue(
            {"TERM001", "ACTION001", "ACTOR001", "COND001", "MODAL001"} <= rule_ids
        )
        self.assertFalse(
            any(finding.file.startswith("records/reports/") for finding in findings)
        )
        self.assertFalse(
            any("excluded sentence" in finding.message for finding in findings)
        )

    def test_safe_and_ambiguous_term_suggestions(self) -> None:
        findings = check_authoring.check_repository(
            self.root, check_authoring.load_config(self.root)
        )
        legacy = next(
            finding
            for finding in findings
            if finding.rule_id == "TERM001" and "legacy term" in finding.message
        )
        self.assertEqual(legacy.suggested_replacement, "CanonicalTerm")
        self.item.write_text(
            self.item.read_text(encoding="utf-8").replace(
                "legacy term", "shared alias"
            ),
            encoding="utf-8",
        )
        findings = check_authoring.check_repository(
            self.root, check_authoring.load_config(self.root)
        )
        shared = next(finding for finding in findings if finding.rule_id == "TERM001")
        self.assertIsNone(shared.suggested_replacement)

    def test_confusable_neighbors_are_not_replacement_aliases(self) -> None:
        self.item.write_text(
            self.item.read_text(encoding="utf-8").replace(
                "legacy term", "NeighborTerm"
            ),
            encoding="utf-8",
        )
        findings = check_authoring.check_repository(
            self.root, check_authoring.load_config(self.root)
        )
        self.assertFalse(any(finding.rule_id == "TERM001" for finding in findings))

    def test_advisory_and_per_rule_enforcement(self) -> None:
        self.assertEqual(check_authoring.main(["--repo-root", str(self.root)]), 0)
        self._write_config(mode="enforcing", blocking=("TERM001",))
        self.assertEqual(
            check_authoring.main(["--repo-root", str(self.root), "--json"]), 1
        )

    def test_check_is_non_mutating(self) -> None:
        before = hashlib.sha256(self.item.read_bytes()).hexdigest()
        check_authoring.check_repository(
            self.root, check_authoring.load_config(self.root)
        )
        after = hashlib.sha256(self.item.read_bytes()).hexdigest()
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
