from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).parents[1]
SPEC = importlib.util.spec_from_file_location("user_instructions", ROOT / "scripts/user_instructions.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class UserInstructionsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve() / "source"
        self.source = self.root / "user/AGENTS.md"
        self.source.parent.mkdir(parents=True)
        self.source.write_text("# Personal defaults\n\nPreserve unrelated work.\n")
        (self.root / "user/practices").mkdir()
        self.profile = self.root / "template/docs/rules/python.md"
        self.profile.parent.mkdir(parents=True)
        self.profile.write_text("# Python\n\nUse the project's runtime.\n")
        self.home = Path(self.temp.name).resolve() / "codex"
        self.home.mkdir()
        self.target = self.home / "AGENTS.md"
        self.installed_profile = self.home / "practices/python.md"

    def sync(self, **options) -> bool:
        with contextlib.redirect_stdout(io.StringIO()):
            return MODULE.sync(self.root, self.home, **options)

    def snapshot(self) -> dict[str, bytes]:
        return {str(p.relative_to(self.home)): p.read_bytes() for p in self.home.rglob("*") if p.is_file()}

    def test_first_adoption_requires_exact_reviewed_hash_and_preserves_original(self) -> None:
        original = b"Existing personal rules\n"
        self.target.write_bytes(original)
        before = self.snapshot()
        self.assertFalse(self.sync(show_diff=True))
        self.assertEqual(before, self.snapshot())
        for accepted in (None, "0" * 64):
            with self.subTest(accepted=accepted):
                with self.assertRaisesRegex(ValueError, "unmanaged|matching"):
                    self.sync(apply=True, adopt={"AGENTS.md": accepted} if accepted else None)
                self.assertEqual(before, self.snapshot())
        self.sync(apply=True, adopt={"AGENTS.md": MODULE.digest(original)})
        self.assertEqual(self.source.read_bytes(), self.target.read_bytes())
        backup = self.home / MODULE.BACKUPS / f"{MODULE.digest(original)}.md"
        self.assertEqual(original, backup.read_bytes())
        self.assertTrue(self.sync())

    def test_fresh_install_update_and_noop_preserve_unrelated_files(self) -> None:
        other = self.home / "config.toml"
        other.write_text("personal configuration")
        self.assertFalse(self.sync())
        self.sync(apply=True)
        previous = self.target.read_bytes()
        self.source.write_text("Reviewed new rules\n")
        before = self.snapshot()
        self.assertFalse(self.sync(show_diff=True))
        self.assertEqual(before, self.snapshot())
        self.sync(apply=True)
        self.assertEqual(previous, (self.home / MODULE.BACKUPS / f"{MODULE.digest(previous)}.md").read_bytes())
        before = self.snapshot()
        with patch.object(MODULE, "atomic_write", side_effect=AssertionError("No-op must not write")):
            self.assertTrue(self.sync(apply=True))
        self.assertEqual(before, self.snapshot())
        self.assertEqual("personal configuration", other.read_text())

    def test_edited_or_missing_installation_blocks_until_deliberate_reconciliation(self) -> None:
        self.sync(apply=True)
        self.target.write_text("Local changes\n")
        before = self.snapshot()
        self.assertFalse(self.sync())
        with self.assertRaisesRegex(ValueError, "local edits"):
            self.sync(apply=True)
        self.assertEqual(before, self.snapshot())
        # Absorb a reviewed local change into the source before explicit re-adoption.
        self.source.write_bytes(self.target.read_bytes())
        self.sync(apply=True, adopt={"AGENTS.md": MODULE.digest(self.target.read_bytes())})
        self.assertTrue(self.sync())
        self.target.unlink()
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "missing"):
            self.sync(apply=True)
        self.assertEqual(before, self.snapshot())

    def test_interrupted_replacement_retries_from_either_known_state(self) -> None:
        for after_replace in (False, True):
            with self.subTest(after_replace=after_replace):
                self.sync(apply=True)
                previous = self.target.read_bytes()
                self.source.write_bytes(previous + b"Reviewed addition\n")
                replace = MODULE.os.replace

                def interrupt(src, dst, *, after_replace=after_replace, replace=replace):
                    if Path(dst) == self.target:
                        if after_replace:
                            replace(src, dst)
                        raise KeyboardInterrupt("process interrupted")
                    return replace(src, dst)

                with patch.object(MODULE.os, "replace", side_effect=interrupt):
                    with self.assertRaises(KeyboardInterrupt):
                        self.sync(apply=True)
                before = self.snapshot()
                self.assertFalse(self.sync(show_diff=True))
                self.assertEqual(before, self.snapshot())
                self.sync(apply=True)
                self.assertTrue(self.sync())
                self.assertEqual(self.source.read_bytes(), self.target.read_bytes())
                self.assertEqual(previous, (self.home / MODULE.BACKUPS / f"{MODULE.digest(previous)}.md").read_bytes())

    def test_unexpected_edit_after_interruption_is_preserved(self) -> None:
        self.sync(apply=True)
        self.source.write_text("Next version\n")
        write = MODULE.atomic_write

        def interrupt(path, content):
            if path == self.target:
                raise OSError("interrupted")
            write(path, content)

        with patch.object(MODULE, "atomic_write", side_effect=interrupt):
            with self.assertRaisesRegex(OSError, "interrupted"):
                self.sync(apply=True)
        self.target.write_text("Independent edit after interruption\n")
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "local edits"):
            self.sync(apply=True)
        self.assertEqual(before, self.snapshot())

    def test_symlinks_and_active_override_block_without_mutation(self) -> None:
        other = Path(self.temp.name) / "other"
        other.write_text("Unrelated file")
        for name in ("AGENTS.md", MODULE.RECEIPT, "AGENTS.override.md", MODULE.BACKUPS):
            with self.subTest(name=name):
                path = self.home / name
                path.symlink_to(other)
                with self.assertRaisesRegex(ValueError, "symlink|real directory"):
                    self.sync(apply=True)
                self.assertEqual("Unrelated file", other.read_text())
                path.unlink()
        override = self.home / "AGENTS.override.md"
        override.write_text("Temporary override\n")
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "shadows"):
            self.sync(apply=True)
        self.assertEqual(before, self.snapshot())

    def test_corrupt_backup_blocks_update(self) -> None:
        self.sync(apply=True)
        previous = self.target.read_bytes()
        backup = self.home / MODULE.BACKUPS / f"{MODULE.digest(previous)}.md"
        backup.parent.mkdir(exist_ok=True)
        backup.write_bytes(b"Unexpected backup edit")
        self.source.write_bytes(previous + b"New version\n")
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "Recovery copy changed"):
            self.sync(apply=True)
        self.assertEqual(before, self.snapshot())

    def test_invalid_sources_and_receipts_are_rejected(self) -> None:
        desired = self.source.read_bytes()
        self.source.write_bytes(b" \n")
        with self.assertRaisesRegex(ValueError, "empty"):
            self.sync(apply=True)
        self.source.write_bytes(desired)
        receipt = self.home / MODULE.RECEIPT
        for value in ([], {}, {"schemaVersion": 1, "installedSha256": "0" * 64}):
            with self.subTest(value=value):
                receipt.write_text(json.dumps(value))
                before = self.snapshot()
                with self.assertRaisesRegex(ValueError, "Invalid"):
                    self.sync(apply=True)
                self.assertEqual(before, self.snapshot())

    def test_cli_honors_codex_home_and_check_exit_status(self) -> None:
        env = dict(os.environ, CODEX_HOME=str(self.home))

        def cli(command, *options):
            return subprocess.run(
                [sys.executable, str(ROOT / "scripts/user_instructions.py"), command, *options],
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )

        self.assertEqual(1, cli("check").returncode)
        self.assertEqual(0, cli("diff").returncode)
        self.assertEqual({}, self.snapshot())
        self.assertEqual(0, cli("sync").returncode)
        self.assertEqual((ROOT / "user/AGENTS.md").read_bytes(), self.target.read_bytes())
        self.assertEqual((ROOT / "template/docs/rules/python.md").read_bytes(), self.installed_profile.read_bytes())
        self.assertEqual(0, cli("check").returncode)
        self.target.write_text("Independent edit\n")
        self.assertEqual(1, cli("sync").returncode)
        self.assertEqual("Independent edit\n", self.target.read_text())

    def test_duplicate_python_source_is_rejected_before_installation_changes(self) -> None:
        self.sync(apply=True)
        before = self.snapshot()
        (self.root / "user/practices/python.md").write_text("Competing Python guidance\n")
        with self.assertRaisesRegex(ValueError, "Duplicate instruction source"):
            self.sync(apply=True)
        self.assertEqual(before, self.snapshot())

    def test_guide_drift_blocks_the_whole_bundle_and_reconciles_one_reviewed_file(self) -> None:
        self.sync(apply=True)
        self.source.write_text("Changed core\n")
        self.installed_profile.write_text("Independent guide change\n")
        before = self.snapshot()
        self.assertFalse(self.sync(show_diff=True))
        with self.assertRaisesRegex(ValueError, "practices/python.md: local edits"):
            self.sync(apply=True)
        self.assertEqual(before, self.snapshot())
        self.profile.write_bytes(self.installed_profile.read_bytes())
        self.sync(apply=True, adopt={"practices/python.md": MODULE.digest(self.installed_profile.read_bytes())})
        self.assertTrue(self.sync())

    def test_unmanaged_guide_collision_and_parent_symlink_block_before_core_changes(self) -> None:
        self.installed_profile.parent.mkdir()
        self.installed_profile.write_text("Existing private guide\n")
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "unmanaged"):
            self.sync(apply=True)
        self.assertEqual(before, self.snapshot())
        self.installed_profile.unlink()
        self.installed_profile.parent.rmdir()
        external = Path(self.temp.name) / "external"
        external.mkdir()
        (self.home / "practices").symlink_to(external, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "symlink"):
            self.sync(apply=True)
        self.assertFalse(self.target.exists())
        self.assertEqual([], list(external.iterdir()))

    def test_partial_bundle_update_retries_without_losing_edits_or_unrelated_files(self) -> None:
        self.sync(apply=True)
        unrelated = self.home / "practices/private-note.md"
        unrelated.write_text("Not managed by repo-kit\n")
        self.profile.write_text("New profile\n")
        self.source.write_text("New core routing\n")
        replace = MODULE.os.replace

        def interrupt(src, dst):
            if Path(dst) == self.target:
                raise OSError("interrupted before routing")
            return replace(src, dst)

        with patch.object(MODULE.os, "replace", side_effect=interrupt):
            with self.assertRaisesRegex(OSError, "interrupted"):
                self.sync(apply=True)
        self.assertEqual(self.profile.read_bytes(), self.installed_profile.read_bytes())
        self.assertNotEqual(self.source.read_bytes(), self.target.read_bytes())
        before = self.snapshot()
        self.assertFalse(self.sync())
        self.assertEqual(before, self.snapshot())
        self.sync(apply=True)
        self.assertTrue(self.sync())
        self.assertEqual("Not managed by repo-kit\n", unrelated.read_text())

    def test_adding_a_guide_preserves_existing_files_and_retirement_needs_reconciliation(self) -> None:
        self.sync(apply=True)
        added = self.root / "user/practices/ui-ux.md"
        added.write_text("Review actual rendered content.\n")
        self.sync(apply=True)
        self.assertEqual(added.read_bytes(), (self.home / "practices/ui-ux.md").read_bytes())
        added.unlink()
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "retirement"):
            self.sync(apply=True)
        self.assertEqual(before, self.snapshot())

    def test_receipt_cannot_escape_managed_paths_or_authorize_absent_final_files(self) -> None:
        for installed in (
            {"AGENTS.md": "0" * 64, "../outside.md": "1" * 64},
            {"AGENTS.md": None},
            {"AGENTS.md": "0" * 64, "practices/nested/file.md": "1" * 64},
        ):
            with self.subTest(installed=installed):
                (self.home / MODULE.RECEIPT).write_text(json.dumps({"schemaVersion": 2, "installed": installed}))
                before = self.snapshot()
                with self.assertRaisesRegex(ValueError, "Invalid"):
                    self.sync(apply=True)
                self.assertEqual(before, self.snapshot())


if __name__ == "__main__":
    unittest.main()
