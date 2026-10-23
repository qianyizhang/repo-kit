from __future__ import annotations

import importlib.util
import json
import subprocess
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

    def ready_model(self) -> dict:
        model = self.review_model()
        model.update(
            revision="review-2",
            scope="Fixture save flow; no other surfaces reviewed.",
            baseline="Synthetic fixture, revision fixture-1, captured 2026-10-23 at 1440x1000.",
        )
        model["elements"][0].update(
            name="Save",
            location="Header",
            purpose="Save the draft",
            reveal="Always visible",
            source="fixture/Header.tsx",
            instances="One button",
            facts=[],
            actions=["save draft"],
        )
        model["screens"][0].update(name="Draft ready", coverage="Save and its container reconciled in the fixture.")
        model["journeys"][0].update(
            name="Save draft", goal="Retain edits", start="Unsaved draft", success="Saved status"
        )
        model["journeys"][0]["steps"][0].update(
            before="Draft is unsaved",
            cue="Enabled Save button",
            action="Click Save",
            after="Saved status appears",
            deferred="Details remain closed",
            recovery="On failure retain draft and retry",
        )
        model["findings"][0].update(
            kind="disclosure",
            evidence="Save remains visible in the fixture",
            effect="User can find the action",
            proposal="Retain placement",
            status="retained",
        )
        return model

    def test_readiness_reports_exact_missing_fields_and_repairs_clear_them(self) -> None:
        model = self.ready_model()
        del model["baseline"]
        del model["elements"][0]["name"]
        del model["journeys"][0]["steps"][0]["cue"]
        page = self.write_review(model)
        before = page.read_bytes()
        self.assertEqual("structurally-valid", VALIDATOR.diagnose(page, "structure")["status"])
        result = VALIDATOR.diagnose(page)
        self.assertEqual("blocked", result["status"])
        self.assertEqual(
            {"/baseline", "/elements/0/name", "/journeys/0/steps/0/cue"},
            {d["subject"]["path"] for d in result["diagnostics"]},
        )
        self.assertTrue(all(d["supportedFixes"] for d in result["diagnostics"]))
        self.assertEqual(before, page.read_bytes())
        repaired = VALIDATOR.diagnose(self.write_review(self.ready_model()))
        self.assertEqual("ready", repaired["status"])
        self.assertNotEqual(result["sha256"], repaired["sha256"])

    def test_declared_gaps_do_not_waive_required_journeys(self) -> None:
        model = self.ready_model()
        model["coverageGaps"] = [{"scope": "Offline error state", "reason": "Fixture cannot disconnect the host"}]
        result = VALIDATOR.diagnose(self.write_review(model))
        self.assertEqual("ready-with-gaps", result["status"])
        self.assertEqual("coverage/declared-gap", result["diagnostics"][0]["code"])
        self.assertEqual(model["coverageGaps"][0], result["diagnostics"][0]["evidence"])
        model["journeys"] = []
        model["findings"] = []
        result = VALIDATOR.diagnose(self.write_review(model))
        self.assertEqual("blocked", result["status"])
        self.assertIn("readiness/journeys", [d["code"] for d in result["diagnostics"]])
        model["coverageGaps"] = [{"scope": "Unknown"}]
        self.assertEqual("blocked", VALIDATOR.diagnose(self.write_review(model))["status"])

    def test_findings_cannot_target_another_screen_or_unmarked_component(self) -> None:
        model = self.ready_model()
        model["screens"].append({**model["screens"][0], "id": "other", "marks": []})
        model["findings"][0]["screen"] = "other"
        result = VALIDATOR.diagnose(self.write_review(model))
        codes = {d["code"] for d in result["diagnostics"]}
        self.assertIn("reference/visible-elements", codes)
        self.assertIn("reference/finding-screen", codes)

    def test_cli_malformed_records_produce_json_failure_without_traceback(self) -> None:
        cases = [
            None,
            {"elements": [None], "screens": {}, "journeys": [3], "findings": []},
            {**self.ready_model(), "elements": [{"id": [], "parent": []}]},
            {**self.ready_model(), "coverageGaps": [False]},
        ]
        for model in cases:
            with self.subTest(model=model):
                page = self.write_review(model)
                run = subprocess.run(
                    [
                        sys.executable,
                        str(ROOT / "skills/ui-discussion/scripts/validate.py"),
                        str(page),
                        "--stage",
                        "ready",
                        "--json",
                    ],
                    capture_output=True,
                    text=True,
                )
                self.assertEqual(1, run.returncode, run.stderr)
                self.assertEqual("", run.stderr)
                result = json.loads(run.stdout)
                self.assertFalse(result["ok"])
                self.assertEqual("blocked", result["status"])

    def test_duplicate_script_invalid_json_and_nonfinite_bounds_fail_closed(self) -> None:
        page = self.write_review(self.ready_model())
        page.write_text(page.read_text() * 2)
        self.assertEqual("input/review-data", VALIDATOR.diagnose(page)["diagnostics"][0]["code"])
        page.write_text('<script id="review-data">{broken}</script>')
        self.assertEqual("input/read", VALIDATOR.diagnose(page)["diagnostics"][0]["code"])
        for value in (True, float("nan"), float("inf")):
            model = self.ready_model()
            model["screens"][0]["marks"][0]["x"] = value
            result = VALIDATOR.diagnose(self.write_review(model))
            self.assertIn("geometry/number", [d["code"] for d in result["diagnostics"]])
            json.dumps(result, allow_nan=False)
