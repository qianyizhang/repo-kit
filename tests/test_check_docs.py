from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).parents[1] / "template" / "scripts" / "check_docs.py"
SPEC = importlib.util.spec_from_file_location("check_docs", SCRIPT)
assert SPEC and SPEC.loader
check_docs = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = check_docs
SPEC.loader.exec_module(check_docs)

METADATA = """---
description: Example document.
scope: fixtures
status: stable
last_update: 2026-09-21
document_class: coordination
---
"""


class CheckDocsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.cfg = check_docs.GovernanceConfig(
            exclude_dirs=frozenset(),
            exclude_path_contains=(),
            repo_path_dirs=("docs",),
            authority_files=frozenset(),
            authority_globs=(),
            skills_dirs=(".codex/skills",),
            deprecated_dir="docs/deprecated",
            index_file="docs/index.md",
            index_route_areas=(),
            document_classes={
                "coordination": check_docs.DocumentClassProfile((), ("",), frozenset()),
                "report": check_docs.DocumentClassProfile(("report_outcome",), ("",), frozenset()),
            },
            symlinks={},
        )
        self.doc = self.root / "example.md"

    def tearDown(self) -> None:
        self.temp.cleanup()

    def check_document(self, content: str) -> list[str]:
        self.doc.write_text(content, encoding="utf-8")
        errors, ignored = check_docs.check_file(self.doc, self.root, self.cfg)
        self.assertFalse(ignored)
        return errors

    def test_required_metadata_needs_nonempty_scalar_values(self) -> None:
        for key, original in (
            ("description", "Example document."),
            ("scope", "fixtures"),
            ("status", "stable"),
            ("last_update", "2026-09-21"),
        ):
            for value in ("", '""', "'   '", "null", "~", "[]", "{}", ">-", "|", "# no value"):
                with self.subTest(key=key, value=value):
                    errors = self.check_document(METADATA.replace(f"{key}: {original}", f"{key}: {value}"))
                    self.assertTrue(any(f"'{key}'" in error for error in errors), errors)
                    if key == "status":
                        self.assertTrue(any("Invalid status" in error for error in errors), errors)

    def test_folded_and_literal_scalars_preserve_actual_content(self) -> None:
        for indicator in (">", ">-", "|", "|+"):
            with self.subTest(indicator=indicator):
                content = METADATA.replace(
                    "description: Example document.", f"description: {indicator}\n  Actual text\n  continues."
                )
                self.assertEqual(self.check_document(content), [])
                metadata, _, error = check_docs.parse_frontmatter(content)
                self.assertEqual(error, "")
                self.assertIn("Actual text", metadata["description"])
                self.assertIn("continues.", metadata["description"])
        content = METADATA.replace("description: Example document.", "description:\n  nested: text")
        self.assertTrue(any("'description'" in error for error in self.check_document(content)))

    def test_scalar_comments_and_hashes_are_distinguished(self) -> None:
        content = METADATA.replace("status: stable", "status: stable # maintained").replace(
            "description: Example document.", 'description: "A # literal" # comment'
        )
        self.assertEqual(self.check_document(content), [])
        metadata, _, _ = check_docs.parse_frontmatter(content)
        self.assertEqual(metadata["description"], "A # literal")

    def test_class_specific_required_fields_reject_empty_values(self) -> None:
        content = METADATA.replace(
            "document_class: coordination",
            "document_class: report\nreport_outcome: inconclusive\ninconclusive_reason: ''\nreview_trigger: ' '",
        )
        errors = self.check_document(content)
        self.assertTrue(any("'inconclusive_reason'" in error for error in errors))
        self.assertTrue(any("'review_trigger'" in error for error in errors))

    def test_markdown_link_titles_and_destinations(self) -> None:
        for name in ("existing.md", "a (draft).md", "nested(draft).md"):
            (self.root / name).touch()
        for link in (
            '[Existing](existing.md "A title")',
            "[Existing](existing.md 'A title')",
            "[Existing](existing.md (A title))",
            '[Existing](<a (draft).md> "A title")',
            '[Existing](nested(draft).md "A title")',
            "[Existing](existing.md#section)",
            '[External](https://example.org/missing "A title")',
        ):
            with self.subTest(link=link):
                self.assertEqual(self.check_document(METADATA + link), [])
        self.assertTrue(
            any(
                "Broken local link" in error
                for error in self.check_document(METADATA + '[Missing](missing.md "A title")')
            )
        )

    def make_item(
        self, work_id: str = "AB-X-001", status: str = "ready", depends_on: str = "none", history: str = ""
    ) -> Path:
        path = self.root / "records/work-items/items" / f"{work_id}-fixture.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            METADATA[:-4]
            + f"work_id: {work_id}\nwork_status: {status}\nwork_kind: build\nadded: 2026-09-21\n"
            + f"tags: fixture\ndepends_on: {depends_on}\nresidual_of: none\nresidual_items: none\n---\n"
            + "## Intent\nFixture.\n## Acceptance Criteria\n- [x] Tested.\n## Context and Trade-offs\nFixture.\n"
            + "## Status History\n| Date | Actor | From | To | Reason / evidence |\n| --- | --- | --- | --- | --- |\n"
            + (history or f"| 2026-09-21 | test | — | {status} | Captured |\n")
            + "## Implementation Ledger\nVerification: fixture.\n",
            encoding="utf-8",
        )
        return path

    def test_current_status_matches_last_history_transition(self) -> None:
        history = "| 2026-09-20 | test | — | ready | Captured |\n| 2026-09-21 | test | ready | done | Complete |\n"
        path = self.make_item(history=history)
        errors = check_docs.check_backlog_items(self.root, [path])
        self.assertTrue(any("final Status History To 'done'" in error for error in errors), errors)
        path = self.make_item(status="done", history=history)
        self.assertEqual(check_docs.check_backlog_items(self.root, [path]), [])

    def test_complete_reference_fields_are_validated(self) -> None:
        other = self.make_item("AB-X-002")
        for value in (
            "AB-typo-123",
            "AB-X-002 and AB-X-003",
            "none, AB-X-002",
            "AB-X-002 garbage",
            "AB-X-002,",
            "[AB-X-002]",
        ):
            with self.subTest(value=value):
                path = self.make_item(depends_on=value)
                errors = check_docs.check_backlog_items(self.root, [path, other])
                self.assertTrue(any("invalid depends_on" in error for error in errors), errors)
        path = self.make_item(depends_on="AB-X-002")
        self.assertEqual(check_docs.check_backlog_items(self.root, [path, other]), [])
        path = self.make_item(depends_on="AB-X-001, AB-X-003")
        errors = check_docs.check_backlog_items(self.root, [path, other])
        self.assertTrue(any("cannot reference itself" in error for error in errors))
        self.assertTrue(any("missing work item 'AB-X-003'" in error for error in errors))

    def test_malformed_partial_residual_returns_diagnostic(self) -> None:
        path = self.make_item(status="partial")
        path.write_text(
            path.read_text(encoding="utf-8").replace("residual_items: none", "residual_items: AB-typo-123"),
            encoding="utf-8",
        )
        errors = check_docs.check_backlog_items(self.root, [path])
        self.assertTrue(any("invalid residual_items" in error for error in errors), errors)

    def test_skill_policy_is_scoped_and_accepts_comments(self) -> None:
        path = self.root / ".codex/skills/example/SKILL.md"
        path.parent.mkdir(parents=True)
        path.write_text(
            METADATA.replace("status: stable", "status: stable\ndisable-model-invocation: true # Explicit only"),
            encoding="utf-8",
        )
        policy = path.parent / "agents/openai.yaml"
        policy.parent.mkdir()
        for content, valid in (
            ("policy:\n  allow_implicit_invocation: false # Explicit only\n", True),
            ("policy: # Invocation settings\n  allow_implicit_invocation: false\n", True),
            ("interface:\n  allow_implicit_invocation: false\n", False),
            ("allow_implicit_invocation: false\n", False),
            ("policy:\n  nested:\n    allow_implicit_invocation: false\n", False),
            ("policy:\n  allow_implicit_invocation: sometimes\n", False),
            ('policy:\n  allow_implicit_invocation: "false"\n', False),
            ("policy:\n  allow_implicit_invocation: false\n  allow_implicit_invocation: true\n", False),
        ):
            with self.subTest(content=content):
                policy.write_text(content, encoding="utf-8")
                errors = check_docs.check_skill_invocation_policies(self.root, self.cfg, [path])
                self.assertEqual(errors == [], valid, errors)


if __name__ == "__main__":
    unittest.main()
