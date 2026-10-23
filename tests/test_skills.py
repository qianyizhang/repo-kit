from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

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

    def install_previous_selection(self) -> None:
        previous = Path(self.temp.name) / "previous"
        shutil.copytree(self.root, previous)
        shutil.rmtree(previous / "skills/ui-discussion")
        lock = json.loads((previous / "skills-lock.json").read_text())
        lock["skills"].remove("ui-discussion")
        lock["files"] = {p: h for p, h in lock["files"].items() if not p.startswith("ui-discussion/")}
        MODULE.write_json(previous / "skills-lock.json", lock)
        with patch.object(MODULE, "LOCAL_SKILLS", tuple(n for n in MODULE.LOCAL_SKILLS if n != "ui-discussion")):
            with contextlib.redirect_stdout(io.StringIO()):
                MODULE.sync(previous, self.target, apply=True)

    def test_additive_upgrade_preserves_existing_skills_and_recovery(self) -> None:
        self.install_previous_selection()
        before = MODULE.files(self.target)
        other = self.target / "medical/SKILL.md"
        other.parent.mkdir()
        other.write_text("independent workflow")
        self.assertFalse(self.sync())
        self.sync(apply=True)
        self.assertTrue(self.sync())
        for path, data in before.items():
            if path != MODULE.RECEIPT:
                self.assertEqual(data, (self.target / path).read_bytes())
        self.assertEqual("independent workflow", other.read_text())
        self.assertEqual(
            (self.root / "skills/ui-discussion/SKILL.md").read_bytes(),
            (self.target / "ui-discussion/SKILL.md").read_bytes(),
        )
        recovery = self.target.parent / ".repo-kit-skill-backups"
        self.assertTrue(any(MODULE.files(path) == before for path in recovery.iterdir()))

    def interrupt_update(self, failure=OSError) -> None:
        self.sync(apply=True)
        source = self.root / "skills/next-slice/SKILL.md"
        source.write_text(source.read_text() + "\nReviewed update.\n")
        MODULE.relock(self.root)
        replace = MODULE.os.replace

        def interrupted(src, dst):
            if Path(dst) == self.target / "improve-codebase-architecture" and ".repo-kit-stage-" in str(src):
                raise failure("interrupted replacement")
            return replace(src, dst)

        with patch.object(MODULE.os, "replace", side_effect=interrupted):
            with self.assertRaisesRegex(failure, "interrupted replacement"):
                self.sync(apply=True)

    def test_interrupted_sync_recovers_on_explicit_retry(self) -> None:
        for failure in (OSError, KeyboardInterrupt):
            with self.subTest(failure=failure.__name__):
                self.interrupt_update(failure)
                before_check = MODULE.files(self.target)
                with self.assertRaisesRegex(ValueError, "Interrupted.*sync"):
                    self.sync()
                self.assertEqual(before_check, MODULE.files(self.target))
                self.sync(apply=True)
                self.assertTrue(self.sync())

    def test_interrupted_sync_preserves_unexpected_edits_before_any_recovery(self) -> None:
        self.interrupt_update()
        path = self.target / "retro/SKILL.md"
        path.write_text("Independent edit after interruption")
        before = MODULE.files(self.target)
        with self.assertRaisesRegex(ValueError, "recovery.*changed"):
            self.sync(apply=True)
        self.assertEqual(before, MODULE.files(self.target))

    def test_process_exit_and_interrupted_rollback_can_retry(self) -> None:
        self.sync(apply=True)
        source = self.root / "skills/next-slice/SKILL.md"
        source.write_text(source.read_text() + "\nUpdated after process exit.\n")
        MODULE.relock(self.root)
        code = """
import importlib.util, os, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location('skills', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
replace = module.os.replace
def interrupted(src, dst):
    if Path(dst).name == 'improve-codebase-architecture' and '.repo-kit-stage-' in str(src):
        os._exit(73)
    return replace(src, dst)
module.os.replace = interrupted
module.sync(Path(sys.argv[2]), Path(sys.argv[3]), apply=True)
"""
        result = subprocess.run(
            [sys.executable, "-c", code, str(ROOT / "scripts/skills.py"), str(self.root), str(self.target)]
        )
        self.assertEqual(73, result.returncode)
        replace = MODULE.os.replace

        def interrupted_recovery(src, dst):
            if Path(dst) == self.target / "improve-codebase-architecture":
                raise OSError("rollback interrupted")
            return replace(src, dst)

        with patch.object(MODULE.os, "replace", side_effect=interrupted_recovery):
            with self.assertRaisesRegex(OSError, "rollback interrupted"):
                self.sync(apply=True)
        self.sync(apply=True)
        self.assertTrue(self.sync())

    def test_completed_installation_with_remaining_record_is_finalized(self) -> None:
        unlink = Path.unlink

        def interrupted(path, *args, **kwargs):
            if path == self.target / MODULE.INTERRUPTED:
                raise OSError("record cleanup interrupted")
            return unlink(path, *args, **kwargs)

        with patch.object(Path, "unlink", interrupted):
            with self.assertRaisesRegex(OSError, "record cleanup interrupted"):
                self.sync(apply=True)
        receipt = (self.target / MODULE.RECEIPT).read_bytes()
        self.sync(apply=True)
        self.assertEqual(receipt, (self.target / MODULE.RECEIPT).read_bytes())
        self.assertTrue(self.sync())

    def test_first_installation_interruption_keeps_unrelated_skills(self) -> None:
        other = self.target / "independent/SKILL.md"
        other.parent.mkdir(parents=True)
        other.write_text("Owned elsewhere")
        replace = MODULE.os.replace

        def interrupted(src, dst):
            if Path(dst) == self.target / "next-slice":
                raise OSError("first installation interrupted")
            return replace(src, dst)

        with patch.object(MODULE.os, "replace", side_effect=interrupted):
            with self.assertRaisesRegex(OSError, "first installation interrupted"):
                self.sync(apply=True)
        self.sync(apply=True)
        self.assertTrue(self.sync())
        self.assertEqual("Owned elsewhere", other.read_text())

    def test_additive_upgrade_rejects_empty_or_populated_unmanaged_destination(self) -> None:
        self.install_previous_selection()
        collision = self.target / "ui-discussion"
        collision.mkdir()
        for populated in (False, True):
            with self.subTest(populated=populated):
                if populated:
                    (collision / "SKILL.md").write_text("independently owned")
                before = MODULE.files(self.target)
                with self.assertRaisesRegex(ValueError, "Unmanaged skill collision"):
                    self.sync(apply=True)
                self.assertEqual(before, MODULE.files(self.target))
                self.assertTrue(collision.is_dir())

    def test_additive_upgrade_rejects_edited_existing_skill(self) -> None:
        self.install_previous_selection()
        (self.target / "next-slice/SKILL.md").write_text("independent changes")
        before = MODULE.files(self.target)
        with self.assertRaisesRegex(ValueError, "local edits or missing files"):
            self.sync(apply=True)
        self.assertEqual(before, MODULE.files(self.target))
        self.assertFalse((self.target / "ui-discussion").exists())

    def test_retired_selection_requires_explicit_reconciliation(self) -> None:
        self.sync(apply=True)
        receipt_path = self.target / MODULE.RECEIPT
        receipt = json.loads(receipt_path.read_text())
        receipt["skills"].append("retired-skill")
        MODULE.write_json(receipt_path, receipt)
        before = MODULE.files(self.target)
        with self.assertRaisesRegex(ValueError, "retired skills"):
            self.sync(apply=True)
        self.assertEqual(before, MODULE.files(self.target))

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
        source = self.root / "skills/codebase-design/SKILL.md"
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

    def upstream_fixture(self) -> Path:
        checkout = Path(self.temp.name) / "upstream"
        checkout.mkdir()
        shutil.copy2(self.root / "skills/mattpocock-LICENSE", checkout / "LICENSE")
        (checkout / ".gitignore").write_text("*.tmp\n")
        for name in MODULE.UPSTREAM_SKILLS:
            shutil.copytree(self.root / "skills" / name, checkout / "skills/engineering" / name)
        # Give this synthetic upstream its own baseline, independent of Git history.
        lock = MODULE.read_lock(self.root)
        lock["upstream"]["files"] = {
            p: h
            for p, h in lock["files"].items()
            if p.split("/")[0] in MODULE.UPSTREAM_SKILLS or p == "mattpocock-LICENSE"
        }
        MODULE.write_json(self.root / "skills-lock.json", lock)
        subprocess.run(["git", "init", "--quiet"], cwd=checkout, check=True)
        self.commit_upstream(checkout)
        return checkout

    def commit_upstream(self, checkout: Path) -> str:
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
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=checkout, text=True).strip()

    def test_refresh_pins_git_content_and_excludes_ignored_files(self) -> None:
        checkout = self.upstream_fixture()
        revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=checkout, text=True).strip()
        (checkout / "skills/engineering/grilling/generated.tmp").write_text("ignored runtime output")
        MODULE.refresh(self.root, checkout, revision)
        lock, content = MODULE.bundle(self.root)
        self.assertEqual(revision, lock["upstream"]["revision"])
        self.assertNotIn("grilling/generated.tmp", content)

    def test_declared_adaptation_relocks_and_preserves_baseline(self) -> None:
        before = MODULE.read_lock(self.root)
        self.sync(apply=True)
        original = MODULE.files(self.target)
        path = "grilling/SKILL.md"
        source = self.root / "skills" / path
        source.write_text(source.read_text() + "\nLocal reviewed change.\n")
        with self.assertRaisesRegex(ValueError, "Bundle differs"):
            self.sync(apply=True)
        self.assertEqual(original, MODULE.files(self.target))
        MODULE.relock(self.root)
        after, content = MODULE.bundle(self.root)
        self.assertEqual(before["upstream"], after["upstream"])
        self.assertNotEqual(before["files"][path], after["files"][path])
        self.sync(apply=True)
        self.assertEqual(content[path], (self.target / path).read_bytes())
        self.assertTrue(self.sync())
        self.assertTrue(
            any(MODULE.files(p) == original for p in (self.target.parent / ".repo-kit-skill-backups").iterdir())
        )

    def test_refresh_preserves_adaptation_and_updates_unadapted_file(self) -> None:
        checkout = self.upstream_fixture()
        local = self.root / "skills/grilling/SKILL.md"
        local.write_text(local.read_text() + "\nLocal workflow.\n")
        MODULE.relock(self.root)
        expected = local.read_bytes()
        upstream = checkout / "skills/engineering/codebase-design/SKILL.md"
        upstream.write_text(upstream.read_text() + "\nUpstream vocabulary.\n")
        revision = self.commit_upstream(checkout)
        MODULE.refresh(self.root, checkout, revision)
        lock, content = MODULE.bundle(self.root)
        self.assertEqual(expected, content["grilling/SKILL.md"])
        self.assertEqual(upstream.read_bytes(), content["codebase-design/SKILL.md"])
        self.assertNotEqual(lock["files"]["grilling/SKILL.md"], lock["upstream"]["files"]["grilling/SKILL.md"])

    def test_conflicting_refresh_preserves_entire_source(self) -> None:
        checkout = self.upstream_fixture()
        upstream = checkout / "skills/engineering/grilling/SKILL.md"
        for remove in (False, True):
            with self.subTest(remove=remove):
                if remove:
                    upstream.unlink()
                else:
                    upstream.write_text(upstream.read_text() + "\nChanged upstream workflow.\n")
                revision = self.commit_upstream(checkout)
                before = MODULE.files(self.root)
                with self.assertRaisesRegex(ValueError, "Upstream changed adapted files.*grilling/SKILL.md"):
                    MODULE.refresh(self.root, checkout, revision)
                self.assertEqual(before, MODULE.files(self.root))

    def test_refresh_rejects_unlocked_source_before_any_write(self) -> None:
        checkout = self.upstream_fixture()
        revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=checkout, text=True).strip()
        (self.root / "skills/grilling/SKILL.md").write_text("unreviewed change")
        before = MODULE.files(self.root)
        with self.assertRaisesRegex(ValueError, "Bundle differs"):
            MODULE.refresh(self.root, checkout, revision)
        self.assertEqual(before, MODULE.files(self.root))

    def test_invalid_adaptations_and_baseline_are_rejected(self) -> None:
        path = self.root / "skills-lock.json"
        original = json.loads(path.read_text())
        for entry in (
            {"../outside": "reason"},
            {"retro/agents/openai.yaml": "reason"},
            {"mattpocock-LICENSE": "reason"},
            {"unknown/SKILL.md": "reason"},
            {"grilling/SKILL.md": " "},
            {"grilling/SKILL.md": 7},
        ):
            with self.subTest(entry=entry):
                lock = json.loads(json.dumps(original))
                lock["adaptations"] = entry
                MODULE.write_json(path, lock)
                with self.assertRaisesRegex(ValueError, "Invalid adaptation"):
                    MODULE.bundle(self.root)
        lock = json.loads(json.dumps(original))
        lock["upstream"]["files"]["../outside"] = "bad"
        MODULE.write_json(path, lock)
        with self.assertRaisesRegex(ValueError, "Invalid locked path"):
            MODULE.bundle(self.root)

    def test_legacy_lock_is_readable_but_cannot_hide_adaptations(self) -> None:
        self.upstream_fixture()
        path = self.root / "skills-lock.json"
        lock = MODULE.read_lock(self.root)
        lock["schemaVersion"] = 1
        lock.pop("adaptations")
        MODULE.write_json(path, lock)
        self.assertEqual(1, MODULE.bundle(self.root)[0]["schemaVersion"])
        MODULE.relock(self.root)
        self.assertEqual(2, MODULE.bundle(self.root)[0]["schemaVersion"])
        lock["adaptations"] = {"grilling/SKILL.md": "reason"}
        MODULE.write_json(path, lock)
        with self.assertRaisesRegex(ValueError, "schema 2"):
            MODULE.bundle(self.root)

    def test_source_and_invocation_selection(self) -> None:
        lock, content = MODULE.bundle(ROOT)
        self.assertEqual(11, len(lock["skills"]))
        for name in MODULE.UPSTREAM_SKILLS:
            expected = {p: h for p, h in lock["upstream"]["files"].items() if p.startswith(name + "/")}
            actual = {p: MODULE.digest(data) for p, data in content.items() if p.startswith(name + "/")}
            self.assertEqual(set(expected), set(actual))
            for path in expected:
                if path not in lock.get("adaptations", {}):
                    self.assertEqual(expected[path], actual[path])
        for name in ("retro", "improve-codebase-architecture"):
            self.assertIn(b"allow_implicit_invocation: false", content[f"{name}/agents/openai.yaml"])
        for name in MODULE.LOCAL_SKILLS:
            self.assertNotIn(b"allow_implicit_invocation: false", content[f"{name}/agents/openai.yaml"])


if __name__ == "__main__":
    unittest.main()
