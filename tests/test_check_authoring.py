from __future__ import annotations

import contextlib
import hashlib
import importlib.util
import io
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
            """| Term | Meaning | Replaced terms | _Avoid_ | ≠ (do not confuse) |
| --- | --- | --- | --- | --- |
| `CanonicalTerm` | One meaning. | legacy term, shared alias | A misleading interpretation | NeighborTerm |
| `OtherTerm` | Another meaning. | shared alias | A different misconception | CanonicalTerm |
| `Pydantic` | Validates structured inputs. | — | The referee | Referee |
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
        (self.root / "CLAUDE.md").write_text("更新文件\uff0c然后运行测试。\n最好记录结果。\n", encoding="utf-8")
        (self.root / "records" / "reports" / "history.md").write_text("Use the legacy term.\n", encoding="utf-8")
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
        self.assertTrue({"TERM001", "ACTION001", "ACTOR001", "COND001", "MODAL001"} <= rule_ids)
        self.assertFalse(any(finding.file.startswith("records/reports/") for finding in findings))
        self.assertFalse(any("excluded sentence" in finding.message for finding in findings))

    def test_safe_and_ambiguous_term_suggestions(self) -> None:
        findings = check_authoring.check_repository(self.root, check_authoring.load_config(self.root))
        legacy = next(
            finding for finding in findings if finding.rule_id == "TERM001" and "legacy term" in finding.message
        )
        self.assertEqual(legacy.suggested_replacement, "CanonicalTerm")
        self.item.write_text(
            self.item.read_text(encoding="utf-8").replace("legacy term", "shared alias"),
            encoding="utf-8",
        )
        findings = check_authoring.check_repository(self.root, check_authoring.load_config(self.root))
        shared = next(finding for finding in findings if finding.rule_id == "TERM001")
        self.assertIsNone(shared.suggested_replacement)

    def test_confusable_neighbors_are_not_replacement_aliases(self) -> None:
        self.item.write_text(
            self.item.read_text(encoding="utf-8").replace("legacy term", "NeighborTerm"),
            encoding="utf-8",
        )
        findings = check_authoring.check_repository(self.root, check_authoring.load_config(self.root))
        self.assertFalse(any(finding.rule_id == "TERM001" for finding in findings))

    def test_human_avoid_prose_does_not_create_replacement_rules(self) -> None:
        self.item.write_text("## Intent\n\nThe referee owns legal moves. Use the legacy term.\n", encoding="utf-8")
        findings = check_authoring.check_repository(self.root, check_authoring.load_config(self.root))
        replacements = [finding for finding in findings if finding.rule_id == "TERM001"]
        self.assertEqual(len(replacements), 1)
        self.assertEqual(replacements[0].suggested_replacement, "CanonicalTerm")

    def test_replaced_terms_column_is_optional_and_has_no_header_aliases(self) -> None:
        glossary = self.root / "docs" / "glossary" / "ddd.md"
        for header in ("_Avoid_", "Aliases", "Terms to avoid", "Replacement terms"):
            with self.subTest(header=header):
                glossary.write_text(
                    f"| Term | {header} |\n| --- | --- |\n| `CanonicalTerm` | legacy term |\n",
                    encoding="utf-8",
                )
                findings = check_authoring.check_repository(self.root, check_authoring.load_config(self.root))
                self.assertFalse(any(finding.rule_id == "TERM001" for finding in findings))

    def test_advisory_and_per_rule_enforcement(self) -> None:
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            self.assertEqual(check_authoring.main(["--repo-root", str(self.root)]), 0)
        self._write_config(mode="enforcing", blocking=("TERM001",))
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            self.assertEqual(check_authoring.main(["--repo-root", str(self.root), "--json"]), 1)

    def test_fenced_headings_do_not_hide_later_selected_prose(self) -> None:
        self.item.write_text(
            "## Intent\n"
            "````markdown\n"
            "## Context and Trade-offs\n"
            "```\n"
            "Use the legacy term inside code.\n"
            "````\n"
            "Use the legacy term here.\n"
            "## Context and Trade-offs\n"
            "~~~markdown\n"
            "## Acceptance Criteria\n"
            "Use the legacy term inside an unselected fence.\n"
            "~~~\n"
            "We need to keep this excluded.\n"
            "## Acceptance Criteria\n"
            "Use the legacy term finally.\n",
            encoding="utf-8",
        )
        selected = check_authoring._selected_lines(self.item, ("Intent", "Acceptance Criteria"))
        self.assertEqual(selected, [(7, "Use the legacy term here."), (15, "Use the legacy term finally.")])
        findings = check_authoring.check_repository(self.root, check_authoring.load_config(self.root))
        self.assertEqual([finding.line for finding in findings if finding.rule_id == "TERM001"], [7, 15])

    def test_mismatched_and_short_fences_do_not_close_code(self) -> None:
        self.item.write_text(
            "## Intent\n~~~~\n```\n~~~\nUse the legacy term.\n~~~~ trailing\n"
            "Use the legacy term.\n~~~~\nUse the legacy term outside.\n",
            encoding="utf-8",
        )
        self.assertEqual(
            check_authoring._selected_lines(self.item, ("Intent",)),
            [(9, "Use the legacy term outside.")],
        )

    def test_literal_spans_are_protected_but_visible_link_prose_is_checked(self) -> None:
        self.item.write_text(
            "## Intent\n"
            "Use `legacy term` and ``legacy term with `ticks` ``.\n"
            "See [reference](https://example.test/legacy-term) and https://example.test/legacy-term.\n"
            "<!--\n"
            "## Context and Trade-offs\n"
            "Use the legacy term.\n"
            "-->\n"
            "    Use the legacy term in indented code.\n"
            "> Use the legacy term in a quotation.\n"
            "Use [legacy term](existing.md) here.\n",
            encoding="utf-8",
        )
        findings = check_authoring.check_repository(self.root, check_authoring.load_config(self.root))
        replacements = [finding for finding in findings if finding.rule_id == "TERM001"]
        self.assertEqual([finding.line for finding in replacements], [9, 10])

    def test_nested_lists_and_blockquotes_remain_enforced_prose(self) -> None:
        self._write_config(mode="enforcing", blocking=("TERM001",))
        self.item.write_text(
            "## Intent\n"
            "- Requirements:\n"
            "    - Use the legacy term.\n"
            "      Keep the legacy term in a continuation.\n"
            "\n"
            "          Use the legacy term in nested indented code.\n"
            "\n"
            "> Use the legacy term in a quotation.\n"
            "> - Use the legacy term in a quoted list.\n",
            encoding="utf-8",
        )
        findings = check_authoring.check_repository(self.root, check_authoring.load_config(self.root))
        replacements = [finding for finding in findings if finding.rule_id == "TERM001"]
        self.assertEqual([finding.line for finding in replacements], [3, 4, 8, 9])
        self.assertTrue(all(finding.severity == "error" for finding in replacements))

    def test_indented_code_does_not_include_indented_paragraph_continuation(self) -> None:
        self.item.write_text(
            "## Intent\n"
            "An ordinary paragraph\n"
            "    uses the legacy term.\n"
            "\n"
            "    Use the legacy term in actual code.\n"
            "    - Use the legacy term inside that code.\n",
            encoding="utf-8",
        )
        findings = check_authoring.check_repository(self.root, check_authoring.load_config(self.root))
        self.assertEqual([finding.line for finding in findings if finding.rule_id == "TERM001"], [3])

    def test_inline_code_closes_only_on_equal_length_backtick_runs(self) -> None:
        self.item.write_text(
            "## Intent\n"
            "Use `foo`` legacy term` as a literal.\n"
            "Use ``foo` legacy term`` as a literal.\n"
            "Use `foo``` legacy term` as another literal.\n"
            "Use `unmatched before ``legacy term`` as a literal.\n"
            "Use the legacy term in prose.\n",
            encoding="utf-8",
        )
        findings = check_authoring.check_repository(self.root, check_authoring.load_config(self.root))
        self.assertEqual([finding.line for finding in findings if finding.rule_id == "TERM001"], [6])

    def test_comment_markers_in_inline_code_do_not_hide_prose(self) -> None:
        self.item.write_text("## Intent\nUse `<!--` before the legacy term.\n", encoding="utf-8")
        selected = check_authoring._selected_lines(self.item, ("Intent",))
        self.assertEqual(len(selected), 1)
        self.assertIn("legacy term", selected[0][1])

    def test_latin_phrase_boundaries_and_chinese_matching(self) -> None:
        for text, phrase, expected in (
            ("legacy terminal", "legacy term", False),
            ("prelegacy term", "legacy term", False),
            ("Use LEGACY TERM.", "legacy term", True),
            ("a pre-legacy-terminal", "legacy-term", False),
            ("Use legacy-term.", "legacy-term", True),
            ("api/clientside", "api/client", False),
            ("Use api/client.", "api/client", True),
            ("这个旧术语仍然匹配", "旧术语", True),
        ):
            with self.subTest(text=text, phrase=phrase):
                self.assertEqual(check_authoring._contains_phrase(text, phrase), expected)

    def test_check_is_non_mutating(self) -> None:
        before = hashlib.sha256(self.item.read_bytes()).hexdigest()
        check_authoring.check_repository(self.root, check_authoring.load_config(self.root))
        after = hashlib.sha256(self.item.read_bytes()).hexdigest()
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
