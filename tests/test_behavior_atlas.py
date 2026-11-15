from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).parents[1]
SPEC = importlib.util.spec_from_file_location("atlas_scaffold", ROOT / "skills/ui-discussion/scripts/scaffold_atlas.py")
MODULE = importlib.util.module_from_spec(SPEC)
with patch.object(sys, "dont_write_bytecode", True):
    SPEC.loader.exec_module(MODULE)


class BehaviorAtlasTest(unittest.TestCase):
    def setUp(self) -> None:
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)

    def test_generated_sources_are_self_contained_and_include_custom_ir(self) -> None:
        model = self.root / "source.json"
        model.write_text('{"version":1,"title":"Custom fixture"}')
        target = MODULE.scaffold(self.root / "atlas", model)
        self.assertEqual(model.read_bytes(), (target / "example.json").read_bytes())
        for name in ("schema.ts", "renderer.ts", "build.ts", "atlas.test.ts", "package-lock.json"):
            self.assertTrue((target / name).is_file(), name)
        self.assertNotIn("dependencies", json.loads((target / "package.json").read_text()))

    def test_existing_and_symlink_targets_preserve_work(self) -> None:
        target = MODULE.scaffold(self.root / "atlas")
        (target / "example.json").write_text("user edit")
        with self.assertRaisesRegex(ValueError, "already exists"):
            MODULE.scaffold(target)
        self.assertEqual("user edit", (target / "example.json").read_text())
        link = self.root / "linked"
        link.symlink_to(target, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "symlink"):
            MODULE.scaffold(link / "new")
        self.assertFalse((target / "new").exists())

    def test_invalid_json_fails_before_creating_output(self) -> None:
        model = self.root / "invalid.json"
        model.write_text("{")
        with self.assertRaises(ValueError):
            MODULE.scaffold(self.root / "atlas", model)
        self.assertFalse((self.root / "atlas").exists())


if __name__ == "__main__":
    unittest.main()
