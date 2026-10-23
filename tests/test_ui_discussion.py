from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).parents[1]
SPEC = importlib.util.spec_from_file_location("ui_scaffold", ROOT / "skills/ui-discussion/scripts/scaffold.py")
MODULE = importlib.util.module_from_spec(SPEC)
with patch.object(sys, "dont_write_bytecode", True):
    SPEC.loader.exec_module(MODULE)
VALIDATOR_SPEC = importlib.util.spec_from_file_location(
    "ui_validate", ROOT / "skills/ui-discussion/scripts/validate.py"
)
VALIDATOR = importlib.util.module_from_spec(VALIDATOR_SPEC)
with patch.object(sys, "dont_write_bytecode", True):
    VALIDATOR_SPEC.loader.exec_module(VALIDATOR)


class UIDiscussionTest(unittest.TestCase):
    def setUp(self) -> None:
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)

    def create(self, topic="presentation", design_root=Path("docs/design")) -> Path:
        return MODULE.scaffold(self.root, design_root, "example", "2026-10-22", topic)

    def test_round_links_and_existing_context_survive_next_round(self) -> None:
        first = self.create()
        index = first.parent / "README.md"
        index.write_text(index.read_text() + "\nAccepted terminology belongs in code/glossary.\n")
        prior = {p: p.read_bytes() for p in first.iterdir()}
        second = self.create("navigation")
        self.assertIn(f"{second.name}/README.md", index.read_text())
        self.assertIn("Accepted terminology", index.read_text())
        for path, data in prior.items():
            self.assertEqual(data, path.read_bytes())
        self.assertNotIn("{{APP}}", (second / "index.html").read_text())

    def test_duplicate_refuses_before_modifying_review(self) -> None:
        first = self.create()
        (first / "index.html").write_text("Reviewed prototype with comments")
        before = {str(p): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        with self.assertRaisesRegex(ValueError, "already exists"):
            self.create()
        self.assertEqual(before, {str(p): p.read_bytes() for p in self.root.rglob("*") if p.is_file()})

    def test_alternate_repository_convention(self) -> None:
        target = self.create(design_root=Path("docs/interfaces"))
        self.assertEqual(target.parent, self.root.resolve() / "docs/interfaces/example")

    def test_traversal_invalid_date_and_symlinks_do_not_write(self) -> None:
        for design_root in (Path("../outside"), Path("/tmp/outside")):
            with self.assertRaisesRegex(ValueError, "relative"):
                self.create(design_root=design_root)
        with self.assertRaises(ValueError):
            MODULE.scaffold(self.root, Path("docs/design"), "example", "2026-02-30", "review")
        real = self.root / "real"
        real.mkdir()
        (self.root / "docs").symlink_to(real, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "symlink"):
            self.create()
        self.assertEqual([], list(real.iterdir()))

    def test_symlink_index_is_not_followed(self) -> None:
        home = self.root / "docs/design/example"
        home.mkdir(parents=True)
        outside = self.root / "context.md"
        outside.write_text("Preserve")
        (home / "README.md").symlink_to(outside)
        with self.assertRaisesRegex(ValueError, "regular file"):
            self.create()
        self.assertEqual("Preserve", outside.read_text())
        self.assertEqual([home / "README.md"], list(home.iterdir()))

    def write_review(self, model: dict) -> Path:
        page = self.root / "index.html"
        page.write_text('<script id="review-data" type="application/json">' + json.dumps(model) + "</script>")
        return page

    def review_model(self) -> dict:
        (self.root / "capture.png").write_bytes(b"capture fixture")
        return {
            "elements": [{"id": "A1", "parent": ""}],
            "screens": [
                {
                    "id": "ready",
                    "kind": "current",
                    "image": "capture.png",
                    "marks": [{"element": "A1", "x": 10, "y": 20, "w": 30, "h": 40}],
                }
            ],
            "journeys": [{"id": "J1", "steps": [{"name": "Start", "screen": "ready", "elements": ["A1"]}]}],
            "findings": [{"id": "F1", "screen": "ready", "elements": ["A1"], "journey": "J1", "step": 0}],
        }

    def test_reference_validation_accepts_linked_map_but_rejects_empty_scaffold(self) -> None:
        model = self.review_model()
        self.assertEqual(model, VALIDATOR.validate(self.write_review(model)))
        empty = self.create()
        with self.assertRaisesRegex(ValueError, "Incomplete scaffold"):
            VALIDATOR.validate(empty / "index.html")

    def test_invalid_geometry_and_parent_chains_are_rejected(self) -> None:
        for issue in ("bounds", "cycle", "missing-capture", "duplicate"):
            with self.subTest(issue=issue):
                model = self.review_model()
                if issue == "bounds":
                    model["screens"][0]["marks"][0]["w"] = 95
                elif issue == "cycle":
                    model["elements"][0]["parent"] = "A1"
                elif issue == "missing-capture":
                    model["screens"][0]["image"] = "absent.png"
                else:
                    model["elements"].append({"id": "A1"})
                with self.assertRaises(ValueError):
                    VALIDATOR.validate(self.write_review(model))

    def test_journey_and_finding_references_cannot_silently_miss_the_layout(self) -> None:
        for issue in ("component", "screen", "finding-step"):
            with self.subTest(issue=issue):
                model = self.review_model()
                if issue == "component":
                    model["journeys"][0]["steps"][0]["elements"] = ["missing"]
                elif issue == "screen":
                    model["journeys"][0]["steps"][0]["screen"] = "missing"
                else:
                    model["findings"][0]["step"] = 2
                with self.assertRaises(ValueError):
                    VALIDATOR.validate(self.write_review(model))
