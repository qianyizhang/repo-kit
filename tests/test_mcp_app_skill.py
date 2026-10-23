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


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    with patch.object(sys, "dont_write_bytecode", True):
        spec.loader.exec_module(module)
    return module


SCAFFOLD = load("mcp_scaffold", "skills/mcp-app/scripts/scaffold.py")
REVIEW = load("mcp_review", "skills/ui-discussion/scripts/validate_integration.py")
UI = load("ui_mcp_scaffold", "skills/ui-discussion/scripts/scaffold.py")


class MCPAppSkillTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()

    def test_starter_is_self_contained_and_never_overwrites(self):
        target = SCAFFOLD.scaffold(self.root / "app", "sample-app")
        package = json.loads((target / "package.json").read_text())
        self.assertEqual("sample-app", package["name"])
        self.assertIn("test:browser", package["scripts"])
        before = {p: p.read_bytes() for p in target.rglob("*") if p.is_file()}
        self.assertTrue(all(b"__APP_ID__" not in data for data in before.values()))
        with self.assertRaisesRegex(ValueError, "already exists"):
            SCAFFOLD.scaffold(target, "sample-app")
        self.assertEqual(before, {p: p.read_bytes() for p in target.rglob("*") if p.is_file()})

    def test_collision_during_creation_does_not_delete_another_owner(self):
        target = self.root / "raced"
        original = Path.mkdir

        def race(path, *args, **kwargs):
            original(path, *args, **kwargs)
            (path / "other-work").write_text("keep")
            raise FileExistsError("concurrent owner")

        with patch.object(Path, "mkdir", race):
            with self.assertRaises(FileExistsError):
                SCAFFOLD.scaffold(target, "sample")
        self.assertEqual("keep", (target / "other-work").read_text())

    def test_invalid_name_and_symlink_parent_refuse_writes(self):
        with self.assertRaises(ValueError):
            SCAFFOLD.scaffold(self.root / "app", "../escape")
        real = self.root / "real"
        real.mkdir()
        link = self.root / "link"
        link.symlink_to(real)
        with self.assertRaisesRegex(ValueError, "symlink"):
            SCAFFOLD.scaffold(link / "app", "sample")
        self.assertEqual([], list(real.iterdir()))

    def test_mcp_round_is_linked_but_empty_content_cannot_pass(self):
        target = UI.scaffold(self.root, Path("docs/design"), "sample", "2026-10-23", "review", mcp=True)
        self.assertIn('href="integration.html"', (target / "index.html").read_text())
        self.assertTrue(REVIEW.validate(target / "integration.html"))
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "skills/ui-discussion/scripts/validate_integration.py"),
                str(target / "integration.html"),
            ],
            capture_output=True,
        )
        self.assertEqual(1, result.returncode)

    def model(self):
        tool = {
            field: "fixture evidence"
            for field in ("purpose", "operation", "authorization", "effect", "scope", "source")
        }
        tool.update(
            name="note_read", visibility=["app", "model"], inputSchema={}, outputSchema={}, example={"id": "one"}
        )
        return {
            "baseline": "fixture build 1",
            "logPolicy": "temporary fixture logs",
            "standalone": "read and copy",
            "coverageGaps": ["host internals unavailable"],
            "registeredTools": ["note_read"],
            "tools": [tool],
            "fixtures": [
                {
                    "id": kind,
                    "name": kind,
                    "kind": kind,
                    "mode": "fixture",
                    "source": "test fixture",
                    "request": {"text": "hi"},
                    "result": {"accepted": True},
                    "reads": [],
                    "sequence": [{"from": "app", "to": "host", "action": "ui/message", "evidence": "fixture"}],
                }
                for kind in ("plain", "selection", "failure")
            ],
        }

    def write(self, model):
        path = self.root / "integration.html"
        path.write_text('<script id="mcp-review-data" type="application/json">' + json.dumps(model) + "</script>")
        return path

    def test_catalog_coverage_and_scoped_read_references_are_checked(self):
        model = self.model()
        self.assertEqual([], REVIEW.validate(self.write(model)))
        model["registeredTools"].append("hidden_tool")
        self.assertTrue(any("match registrations" in error for error in REVIEW.validate(self.write(model))))
        model = self.model()
        model["fixtures"][0]["reads"] = [{"tool": "unknown", "scope": "everything"}]
        self.assertTrue(any("documented tool" in error for error in REVIEW.validate(self.write(model))))


if __name__ == "__main__":
    unittest.main()
