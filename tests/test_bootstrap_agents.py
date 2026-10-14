from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).parents[1] / "template" / "scripts" / "bootstrap_agents.py"
SPEC = importlib.util.spec_from_file_location("bootstrap_agents", SCRIPT)
assert SPEC and SPEC.loader
bootstrap_agents = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bootstrap_agents)


class BootstrapAgentsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve() / "repo"
        self.root.mkdir()
        (self.root / ".codex/skills").mkdir(parents=True)
        self.write_map({".agents": ".codex", ".claude/skills": "../.codex/skills"})

    def tearDown(self) -> None:
        self.temp.cleanup()

    def write_map(self, links: dict[str, str]) -> None:
        lines = ["[tool.doc_governance.symlinks]"]
        lines.extend(f"{json.dumps(link)} = {json.dumps(target)}" for link, target in links.items())
        (self.root / "pyproject.toml").write_text("\n".join(lines), encoding="utf-8")

    def run_bootstrap(self, *, check_only: bool = False) -> tuple[int, str]:
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            result = bootstrap_agents.bootstrap(self.root, check_only)
        return result, output.getvalue()

    def test_creates_layout_and_preserves_correct_links(self) -> None:
        self.assertEqual(self.run_bootstrap()[0], 0)
        link = self.root / ".claude/skills"
        self.assertEqual(os.readlink(link), "../.codex/skills")
        before = link.lstat()
        self.assertEqual(self.run_bootstrap()[0], 0)
        self.assertEqual(link.lstat(), before)
        self.assertEqual(self.run_bootstrap(check_only=True)[0], 0)

    def test_check_does_not_create_parent_or_repair_broken_link(self) -> None:
        link = self.root / ".agents"
        link.symlink_to("missing")
        self.assertEqual(self.run_bootstrap(check_only=True)[0], 1)
        self.assertEqual(os.readlink(link), "missing")
        self.assertFalse((self.root / ".claude").exists())
        self.assertEqual(self.run_bootstrap()[0], 0)
        self.assertEqual(link.resolve(), self.root / ".codex")

    def test_real_paths_block_all_writes(self) -> None:
        for is_directory in (False, True):
            with self.subTest(is_directory=is_directory):
                path = self.root / ".claude/skills"
                path.parent.mkdir(exist_ok=True)
                if is_directory:
                    path.mkdir()
                else:
                    path.write_text("owned", encoding="utf-8")
                self.assertEqual(self.run_bootstrap()[0], 1)
                self.assertFalse((self.root / ".agents").is_symlink())
                if is_directory:
                    path.rmdir()
                else:
                    self.assertEqual(path.read_text(encoding="utf-8"), "owned")
                    path.unlink()

    def test_external_parent_is_rejected_before_any_write(self) -> None:
        outside = self.root.parent / "outside"
        outside.mkdir()
        (self.root / ".claude").symlink_to(outside)
        result, output = self.run_bootstrap()
        self.assertEqual(result, 1)
        self.assertIn("escapes the repository", output)
        self.assertFalse((self.root / ".agents").is_symlink())
        self.assertEqual(list(outside.iterdir()), [])

    def test_non_directory_parent_is_rejected_before_any_write(self) -> None:
        (self.root / ".claude").write_text("owned", encoding="utf-8")
        self.assertEqual(self.run_bootstrap()[0], 1)
        self.assertFalse((self.root / ".agents").is_symlink())

    def test_relative_in_repository_destinations_and_targets_are_required(self) -> None:
        outside = self.root.parent / "outside"
        outside.mkdir()
        (self.root / "external").symlink_to(outside)
        for link, target in (
            (str(outside / "absolute"), ".codex"),
            ("../escape", ".codex"),
            ("alias", str(self.root / ".codex")),
            ("alias", "../outside"),
            ("alias", "external"),
        ):
            with self.subTest(link=link, target=target):
                self.write_map({".agents": ".codex", link: target})
                self.assertEqual(self.run_bootstrap()[0], 1)
                self.assertFalse((self.root / ".agents").is_symlink())
                self.assertEqual(list(outside.iterdir()), [])

    def test_internal_symlink_parent_uses_physical_target_resolution(self) -> None:
        (self.root / "config/claude").mkdir(parents=True)
        expected = self.root / "config/.codex/skills"
        expected.mkdir(parents=True)
        (self.root / ".claude").symlink_to("config/claude")
        self.assertEqual(self.run_bootstrap()[0], 0)
        self.assertEqual((self.root / ".claude/skills").resolve(), expected)
        self.assertEqual(self.run_bootstrap(check_only=True)[0], 0)

    def test_overlapping_destinations_are_rejected(self) -> None:
        self.write_map({".agents": ".codex", ".agents/skills": "../.codex/skills"})
        self.assertEqual(self.run_bootstrap()[0], 1)
        self.assertFalse((self.root / ".agents").exists())

    def test_failed_repair_verification_is_not_reported_as_success(self) -> None:
        original_symlink_to = Path.symlink_to

        def create_wrong_link(path: Path, target: str) -> None:
            original_symlink_to(path, "missing")

        with patch.object(Path, "symlink_to", create_wrong_link):
            result, output = self.run_bootstrap()
        self.assertEqual(result, 1)
        self.assertNotIn("[REPAIRED]", output)
        self.assertIn("does not resolve", output)


if __name__ == "__main__":
    unittest.main()
