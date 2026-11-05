from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]


class InstallationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve() / "source"
        self.root.mkdir()
        archive = subprocess.check_output(["git", "archive", "HEAD", "user", "skills", "skills-lock.json"], cwd=ROOT)
        with tarfile.open(fileobj=io.BytesIO(archive)) as stream:
            stream.extractall(self.root, filter="data")
        scripts = self.root / "scripts"
        scripts.mkdir()
        for name in ("installation.py", "skills.py", "user_instructions.py"):
            source = ROOT / "scripts" / name
            if source.exists():
                (scripts / name).write_bytes(source.read_bytes())
        self.git("init", "-q")
        self.git("config", "user.name", "Test")
        self.git("config", "user.email", "test@example.invalid")
        self.git("config", "core.hooksPath", str(self.root / "no-hooks"))
        self.commit()
        self.home = Path(self.temp.name) / "codex"
        self.skills = Path(self.temp.name) / "skills"

    def git(self, *args: str) -> str:
        return subprocess.check_output(["git", *args], cwd=self.root, text=True).strip()

    def commit(self) -> str:
        self.git("add", ".")
        self.git("commit", "-qm", "Fixture")
        return self.git("rev-parse", "HEAD")

    def cli(self, script: str, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(self.root / "scripts" / script), *args],
            cwd=self.root,
            env=dict(os.environ, CODEX_HOME=str(self.home)),
            capture_output=True,
            text=True,
            check=False,
        )

    def install(self, revision: str = "HEAD") -> None:
        for script, options in (
            ("user_instructions.py", []),
            ("skills.py", ["--installed-root", str(self.skills)]),
        ):
            result = self.cli(script, "sync", "--revision", revision, *options)
            self.assertEqual(0, result.returncode, result.stderr + result.stdout)

    def status(self, revision: str = "HEAD") -> subprocess.CompletedProcess:
        return self.cli("installation.py", "status", "--revision", revision, "--installed-root", str(self.skills))

    def receipt(self, skill: bool = False) -> Path:
        return self.skills / ".repo-kit-skills.json" if skill else self.home / ".repo-kit-user-instructions.json"

    def test_revision_install_and_status_ignore_unfinished_worktree(self) -> None:
        revision = self.git("rev-parse", "HEAD")
        dirty = self.root / "skills/ui-discussion/SKILL.md"
        dirty.write_text("Unfinished UI work\n")
        (self.root / "user/practices/draft.md").write_text("Unfinished instruction\n")
        self.install()
        self.assertEqual("Unfinished UI work\n", dirty.read_text())
        self.assertNotEqual(dirty.read_bytes(), (self.skills / "ui-discussion/SKILL.md").read_bytes())
        self.assertFalse((self.home / "practices/draft.md").exists())
        for skill in (False, True):
            self.assertEqual(revision, json.loads(self.receipt(skill).read_text())["sourceRevision"])
        before = self.receipt().read_bytes(), self.receipt(True).read_bytes()
        result = self.status()
        self.assertEqual(0, result.returncode, result.stderr + result.stdout)
        self.assertIn(revision, result.stdout)
        self.assertIn("CURRENT", result.stdout)
        self.assertEqual(before, (self.receipt().read_bytes(), self.receipt(True).read_bytes()))

    def test_content_drift_and_missing_files_fail_status_without_writes(self) -> None:
        self.install()
        instruction = self.home / "practices/python.md"
        instruction.write_text("Independent user edit\n")
        (self.skills / "grilling/SKILL.md").unlink()
        before = self.receipt().read_bytes(), self.receipt(True).read_bytes()
        result = self.status()
        self.assertEqual(1, result.returncode)
        self.assertIn("OUTDATED", result.stdout)
        self.assertIn("practices/python.md", result.stdout)
        self.assertIn("grilling/SKILL.md", result.stdout)
        self.assertEqual("Independent user edit\n", instruction.read_text())
        self.assertEqual(before, (self.receipt().read_bytes(), self.receipt(True).read_bytes()))
        result = self.cli("user_instructions.py", "sync", "--revision", "HEAD")
        self.assertEqual(1, result.returncode)
        self.assertIn("local edits", result.stderr)

    def test_legacy_receipts_upgrade_and_metadata_refresh_are_idempotent(self) -> None:
        self.install()
        for skill in (False, True):
            path = self.receipt(skill)
            data = json.loads(path.read_text())
            data.pop("sourceRevision")
            path.write_text(json.dumps(data))
        self.assertEqual(0, self.status().returncode)
        (self.root / "unrelated.txt").write_text("Unrelated commit\n")
        revision = self.commit()
        self.install()
        for skill in (False, True):
            self.assertEqual(revision, json.loads(self.receipt(skill).read_text())["sourceRevision"])
        before = self.receipt().stat().st_mtime_ns, self.receipt(True).stat().st_mtime_ns
        self.install()
        self.assertEqual(before, (self.receipt().stat().st_mtime_ns, self.receipt(True).stat().st_mtime_ns))

    def test_worktree_install_does_not_claim_uncommitted_content_has_a_revision(self) -> None:
        (self.root / "user/practices/python.md").write_text("Uncommitted rules\n")
        result = self.cli("user_instructions.py", "sync")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIsNone(json.loads(self.receipt().read_text())["sourceRevision"])
        self.assertEqual(1, self.status().returncode)

    def test_older_revision_is_compared_to_selected_content(self) -> None:
        old = self.git("rev-parse", "HEAD")
        self.install()
        (self.root / "user/practices/python.md").write_text("New committed rules\n")
        self.commit()
        self.assertEqual(1, self.status().returncode)
        self.assertEqual(0, self.status(old).returncode)
        self.install()
        self.assertEqual(0, self.status().returncode)

    def test_invalid_revision_or_receipt_is_a_diagnostic_not_a_traceback(self) -> None:
        result = self.status("missing-ref")
        self.assertNotEqual(0, result.returncode)
        self.assertNotIn("Traceback", result.stderr)
        self.assertFalse(self.home.exists())
        self.install()
        data = json.loads(self.receipt().read_text())
        data["sourceRevision"] = "not-a-commit"
        self.receipt().write_text(json.dumps(data))
        before = self.receipt().read_bytes()
        result = self.status()
        self.assertEqual(1, result.returncode)
        self.assertNotIn("Traceback", result.stderr + result.stdout)
        self.assertEqual(before, self.receipt().read_bytes())
        for invalid in ([], {}, {"schemaVersion": 1, "skills": [None]}):
            self.receipt(True).write_text(json.dumps(invalid))
            result = self.status()
            self.assertEqual(1, result.returncode)
            self.assertNotIn("Traceback", result.stderr + result.stdout)

    def test_override_and_managed_symlink_are_reported_without_following_them(self) -> None:
        self.install()
        override = self.home / "AGENTS.override.md"
        override.write_text("Active override\n")
        outside = Path(self.temp.name) / "outside"
        outside.write_text("Unrelated bytes\n")
        managed = self.skills / "grilling/SKILL.md"
        managed.unlink()
        managed.symlink_to(outside)
        result = self.status()
        self.assertEqual(1, result.returncode)
        self.assertIn("shadows", result.stdout)
        self.assertIn("symlink", result.stdout.lower())
        self.assertEqual("Unrelated bytes\n", outside.read_text())
        self.assertTrue(managed.is_symlink())

    def test_receipt_tampering_extra_files_and_interrupted_sync_fail_status(self) -> None:
        self.install()
        receipt = self.receipt(True)
        data = json.loads(receipt.read_text())
        data["files"]["grilling/SKILL.md"] = "0" * 64
        receipt.write_text(json.dumps(data))
        self.assertEqual(1, self.status().returncode)
        data["files"]["grilling/SKILL.md"] = json.loads((self.root / "skills-lock.json").read_text())["files"][
            "grilling/SKILL.md"
        ]
        receipt.write_text(json.dumps(data))
        extra = self.skills / "ui-discussion/untracked.txt"
        extra.write_text("Independent file\n")
        self.assertEqual(1, self.status().returncode)
        extra.unlink()
        marker = self.skills / ".repo-kit-skills-interrupted.json"
        marker.write_text("{}")
        self.assertEqual(1, self.status().returncode)
        self.assertTrue(marker.exists())


if __name__ == "__main__":
    unittest.main()
