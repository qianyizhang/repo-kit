from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
SPEC = importlib.util.spec_from_file_location("skill_sync", ROOT / "scripts/skills.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SkillSyncTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "source"
        self.root.mkdir()
        shutil.copytree(ROOT / "skills", self.root / "skills")
        shutil.copy2(ROOT / "skills-lock.json", self.root / "skills-lock.json")
        self.target = Path(self.temp.name) / "installed"

    def sync(self, **options) -> bool:
        with contextlib.redirect_stdout(io.StringIO()):
            return MODULE.sync(self.root, self.target, **options)

    def test_install_update_and_idempotence_preserve_unrelated_skills(self) -> None:
        other = self.target / "medical" / "SKILL.md"
        other.parent.mkdir(parents=True)
        other.write_text("local medical workflow")
        self.sync(apply=True)
        self.assertTrue(self.sync())
        receipt = (self.target / MODULE.RECEIPT).read_bytes()
        backup_root = self.target.parent / ".repo-kit-skill-backups"
        backups = set(backup_root.iterdir())
        self.sync(apply=True)
        self.assertEqual(receipt, (self.target / MODULE.RECEIPT).read_bytes())
        self.assertEqual(backups, set(backup_root.iterdir()))
        source = self.root / "skills/next-slice/SKILL.md"
        source.write_text(source.read_text() + "\nA reviewed improvement.\n")
        MODULE.relock(self.root)
        self.assertFalse(self.sync())
        self.sync(apply=True)
        self.assertTrue(self.sync())
        self.assertEqual(source.read_bytes(), (self.target / "next-slice/SKILL.md").read_bytes())
        self.assertEqual("local medical workflow", other.read_text())

    def test_local_edits_missing_files_and_extra_files_block_all_writes(self) -> None:
        for kind in ("edit", "missing", "extra"):
            with self.subTest(kind=kind):
                shutil.rmtree(self.target, ignore_errors=True)
                self.sync(apply=True)
                path = self.target / "grilling/SKILL.md"
                if kind == "edit":
                    path.write_text("independent changes")
                elif kind == "missing":
                    path.unlink()
                else:
                    (self.target / "grilling/notes.md").write_text("independent notes")
                before = MODULE.files(self.target)
                with self.assertRaisesRegex(ValueError, "local edits or missing files"):
                    self.sync(apply=True)
                self.assertEqual(before, MODULE.files(self.target))

    def test_unmanaged_collisions_and_symlinks_are_not_adopted(self) -> None:
        collision = self.target / "grilling"
        shutil.copytree(self.root / "skills/grilling", collision)
        with self.assertRaisesRegex(ValueError, "Unmanaged skill collision"):
            self.sync(apply=True)
        shutil.rmtree(collision)
        outside = Path(self.temp.name) / "other"
        outside.mkdir()
        collision.symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "real directory"):
            self.sync(apply=True)
        self.assertTrue(collision.is_symlink())
        self.assertEqual([], list(outside.iterdir()))

    def test_source_drift_and_upstream_relocking_are_rejected(self) -> None:
        source = self.root / "skills/grilling/SKILL.md"
        source.write_text("modified upstream")
        with self.assertRaisesRegex(ValueError, "Bundle differs"):
            self.sync(apply=True)
        with self.assertRaisesRegex(ValueError, "Upstream files changed"):
            MODULE.relock(self.root)
        self.assertFalse(self.target.exists())

    def test_locked_path_traversal_is_rejected(self) -> None:
        path = self.root / "skills-lock.json"
        lock = json.loads(path.read_text())
        lock["files"]["../outside"] = "0" * 64
        MODULE.write_json(path, lock)
        with self.assertRaisesRegex(ValueError, "Invalid locked path"):
            MODULE.bundle(self.root)

    def test_unselected_content_and_missing_manifests_cannot_be_locked(self) -> None:
        extra = self.root / "skills/extra.txt"
        extra.write_text("not part of the installed selection")
        before = (self.root / "skills-lock.json").read_bytes()
        with self.assertRaisesRegex(ValueError, "Unexpected bundle path"):
            MODULE.relock(self.root)
        self.assertEqual(before, (self.root / "skills-lock.json").read_bytes())
        extra.unlink()
        (self.root / "skills/next-slice/SKILL.md").unlink()
        with self.assertRaisesRegex(ValueError, "Missing skill manifest"):
            MODULE.relock(self.root)

    def test_refresh_pins_git_content_and_excludes_ignored_files(self) -> None:
        checkout = Path(self.temp.name) / "upstream"
        checkout.mkdir()
        (checkout / "LICENSE").write_text("MIT license")
        (checkout / ".gitignore").write_text("*.tmp\n")
        for name in MODULE.UPSTREAM_SKILLS:
            source = checkout / "skills/engineering" / name
            source.mkdir(parents=True)
            (source / "SKILL.md").write_text(f"---\nname: {name}\ndescription: A skill.\n---\n")
        subprocess.run(["git", "init", "--quiet"], cwd=checkout, check=True)
        subprocess.run(["git", "add", "."], cwd=checkout, check=True)
        subprocess.run(
            [
                "git",
                "-c",
                "user.name=Skill test",
                "-c",
                "user.email=skill@test.invalid",
                "commit",
                "--quiet",
                "-m",
                "source",
            ],
            cwd=checkout,
            check=True,
        )
        revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=checkout, text=True).strip()
        (checkout / "skills/engineering/grilling/generated.tmp").write_text("ignored runtime output")
        MODULE.refresh(self.root, checkout, revision)
        lock, content = MODULE.bundle(self.root)
        self.assertEqual(revision, lock["upstream"]["revision"])
        self.assertNotIn("grilling/generated.tmp", content)

    def test_source_and_invocation_selection(self) -> None:
        lock, content = MODULE.bundle(ROOT)
        self.assertEqual(8, len(lock["skills"]))
        for name in MODULE.UPSTREAM_SKILLS:
            expected = {p: h for p, h in lock["upstream"]["files"].items() if p.startswith(name + "/")}
            actual = {p: MODULE.digest(data) for p, data in content.items() if p.startswith(name + "/")}
            self.assertEqual(expected, actual)
        for name in ("retro", "improve-codebase-architecture"):
            self.assertIn(b"allow_implicit_invocation: false", content[f"{name}/agents/openai.yaml"])
        for name in MODULE.LOCAL_SKILLS:
            self.assertNotIn(b"allow_implicit_invocation: false", content[f"{name}/agents/openai.yaml"])


if __name__ == "__main__":
    unittest.main()
