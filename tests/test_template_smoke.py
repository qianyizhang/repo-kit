from __future__ import annotations

import io
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
COPIER_VERSION = "9.17.1"
FIXTURE_V1 = "fixture-v1"
FIXTURE_V2 = "fixture-v2"
HISTORICAL_BASELINE = "v0.10.3"
FIXTURE_HISTORICAL = "fixture-historical"
V2_MARKER = "<!-- repo-kit-smoke-v2 -->"
SEED_V2_MARKER = "# repo-kit-smoke-seed-v2"

SEEDED_PATHS = (
    "CLAUDE.md",
    "docs/index.md",
    "docs/glossary/ddd.md",
    "records/work-items/backlog.md",
    "pyproject-doc-governance.toml",
)


class TemplateOwnershipContractTest(unittest.TestCase):
    def test_governance_delivery_does_not_duplicate_shared_skills(self) -> None:
        self.assertEqual([], list((ROOT / "template/.codex/skills").glob("*/SKILL.md")))
        selected = json.loads((ROOT / "skills-lock.json").read_text())["skills"]
        self.assertEqual(set(selected), {p.parent.name for p in (ROOT / "skills").glob("*/SKILL.md")})

    def test_seeded_path_inventory_matches_copier(self) -> None:
        config = (ROOT / "copier.yml").read_text(encoding="utf-8")
        block = re.search(r"(?m)^_skip_if_exists:\n((?:  - .+\n)+)", config)
        self.assertIsNotNone(block)
        declared = {line.removeprefix("  - ").strip().strip('"') for line in block.group(1).splitlines()}
        self.assertEqual(declared, set(SEEDED_PATHS))


def run(
    *args: str,
    cwd: Path,
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["UV_CACHE_DIR"] = str(ROOT / ".cache" / "uv")
    env["UV_TOOL_DIR"] = str(ROOT / ".cache" / "uv-tools")
    result = subprocess.run(
        args,
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        command = " ".join(args)
        raise AssertionError(
            f"command failed ({result.returncode}): {command}\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )
    return result


def copier(*args: str, cwd: Path) -> subprocess.CompletedProcess[str]:
    return run("uvx", "--from", f"copier=={COPIER_VERSION}", "copier", *args, cwd=cwd)


@unittest.skipUnless(
    os.environ.get("REPO_KIT_COPIER_SMOKE") == "1",
    "set REPO_KIT_COPIER_SMOKE=1 to run the networked Copier contract",
)
class CopierTemplateSmokeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp = tempfile.TemporaryDirectory()
        cls.temp_root = Path(cls.temp.name)
        cls.source = cls.temp_root / "source"
        cls.source.mkdir()

        # Exercise a real seeded-to-managed transition, not only marker changes
        # between two versions of the current ownership map.
        archive = subprocess.check_output(["git", "archive", HISTORICAL_BASELINE, "copier.yml", "template"], cwd=ROOT)
        with tarfile.open(fileobj=io.BytesIO(archive)) as historical:
            historical.extractall(cls.source, filter="data")
        run("git", "init", cwd=cls.source)
        run("git", "config", "user.name", "repo-kit smoke", cwd=cls.source)
        run("git", "config", "user.email", "smoke@repo-kit.invalid", cwd=cls.source)
        run("git", "add", ".", cwd=cls.source)
        run("git", "commit", "-m", f"historical product at {HISTORICAL_BASELINE}", cwd=cls.source)
        run("git", "tag", FIXTURE_HISTORICAL, cwd=cls.source)
        run("git", "rm", "-r", "--quiet", ".", cwd=cls.source)

        # Snapshot the Git index: staged release content, never arbitrary
        # unstaged or untracked files from the live worktree.
        prefix = f"--prefix={cls.source}{os.sep}"
        run("git", "checkout-index", "--all", prefix, cwd=ROOT)
        run("git", "add", ".", cwd=cls.source)
        run("git", "commit", "-m", "fixture v1", cwd=cls.source)
        run("git", "tag", FIXTURE_V1, cwd=cls.source)

        cls.managed_paths = tuple(cls.source / "template/docs/rules" / name for name in ("skill.md", "governance.md"))
        for path in cls.managed_paths:
            path.write_text(f"{path.read_text(encoding='utf-8').rstrip()}\n\n{V2_MARKER}\n")
        for relative in SEEDED_PATHS:
            path = cls.source / "template" / f"{relative}.jinja"
            path.write_text(f"{path.read_text(encoding='utf-8').rstrip()}\n\n{SEED_V2_MARKER}\n")
        run("git", "add", "template", cwd=cls.source)
        run("git", "commit", "-m", "fixture v2", cwd=cls.source)
        run("git", "tag", FIXTURE_V2, cwd=cls.source)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temp.cleanup()

    def copy(self, destination: Path, ref: str = FIXTURE_V1) -> None:
        copier(
            "copy",
            "--trust",
            "--defaults",
            "--vcs-ref",
            ref,
            "--data",
            "project_name=smoke-project",
            "--data",
            "project_tagline=Rendered smoke project.",
            str(self.source),
            str(destination),
            cwd=ROOT,
        )

    def test_first_copy_passes_document_gate_and_accepts_advisory_records(self) -> None:
        destination = self.temp_root / "first-copy"
        self.copy(destination)
        (destination / "pyproject-doc-governance.toml").replace(destination / "pyproject.toml")

        run(sys.executable, "scripts/bootstrap_agents.py", cwd=destination)
        run(sys.executable, "scripts/check_docs.py", cwd=destination)

        campaign_dir = destination / "records" / "campaigns"
        campaign_dir.mkdir(parents=True)
        (campaign_dir / "pilot.md").write_text(
            """---
description: Smoke-test Campaign.
scope: template smoke test
status: experimental
last_update: 2026-08-17
document_class: coordination
---

# Campaign — smoke test

## Destination

Prove that an advisory Campaign needs no dedicated document class or status.
""",
            encoding="utf-8",
        )

        reports_dir = destination / "records" / "reports"
        reports_dir.mkdir(parents=True)
        (reports_dir / "handoff.md").write_text(
            """---
description: Smoke-test coordination handoff.
scope: template smoke test
status: experimental
last_update: 2026-08-17
document_class: coordination
---

# Session handoff — smoke test
""",
            encoding="utf-8",
        )
        run(sys.executable, "scripts/check_docs.py", cwd=destination)

    def test_update_manages_governance_and_preserves_bindings(self) -> None:
        destination = self.temp_root / "update"
        self.copy(destination)

        seed_marker = "<!-- consumer-owned -->"
        for relative in SEEDED_PATHS:
            path = destination / relative
            path.write_text(f"{path.read_text(encoding='utf-8').rstrip()}\n\n{seed_marker}\n")

        run("git", "init", cwd=destination)
        run("git", "config", "user.name", "repo-kit smoke", cwd=destination)
        run("git", "config", "user.email", "smoke@repo-kit.invalid", cwd=destination)
        run("git", "add", ".", cwd=destination)
        run("git", "commit", "-m", "consumer baseline", cwd=destination)

        copier("update", "--trust", "--defaults", "--vcs-ref", FIXTURE_V2, cwd=destination)

        for relative in SEEDED_PATHS:
            content = (destination / relative).read_text(encoding="utf-8")
            self.assertIn(seed_marker, content)
            self.assertNotIn(SEED_V2_MARKER, content)
        for source_path in self.managed_paths:
            relative = source_path.relative_to(self.source / "template")
            self.assertIn(V2_MARKER, (destination / relative).read_text(encoding="utf-8"))

    def test_historical_update_requires_binding_reconciliation_and_then_passes_gate(self) -> None:
        destination = self.temp_root / "historical-update"
        self.copy(destination, FIXTURE_HISTORICAL)
        config_path = destination / "pyproject.toml"
        (destination / "pyproject-doc-governance.toml").replace(config_path)
        local_setting = '\n[tool.consumer_fixture]\nretained = "consumer owned"\n'
        config_path.write_text(config_path.read_text(encoding="utf-8") + local_setting, encoding="utf-8")
        local_marker = "<!-- retained consumer policy -->"
        constitution = destination / "CLAUDE.md"
        constitution.write_text(constitution.read_text(encoding="utf-8") + local_marker, encoding="utf-8")
        glossary = destination / "docs/glossary/ddd.md"
        glossary.write_text(glossary.read_text(encoding="utf-8") + local_marker, encoding="utf-8")
        run("git", "init", cwd=destination)
        run("git", "config", "user.name", "repo-kit smoke", cwd=destination)
        run("git", "config", "user.email", "smoke@repo-kit.invalid", cwd=destination)
        run("git", "add", ".", cwd=destination)
        run("git", "commit", "-m", "consumer historical baseline", cwd=destination)

        copier("update", "--trust", "--defaults", "--vcs-ref", FIXTURE_V1, cwd=destination)
        self.assertIn(local_marker, constitution.read_text(encoding="utf-8"))
        self.assertIn(local_marker, glossary.read_text(encoding="utf-8"))
        self.assertIn(local_setting, config_path.read_text(encoding="utf-8"))
        self.assertFalse((destination / ".codex/skills/handoff/SKILL.md").exists())
        run(sys.executable, "scripts/bootstrap_agents.py", cwd=destination)
        before = subprocess.run(
            [sys.executable, "scripts/check_docs.py"], cwd=destination, text=True, capture_output=True, check=False
        )
        self.assertNotEqual(before.returncode, 0, "preserved historical bindings need semantic reconciliation")
        self.assertIn("[FAIL]", before.stdout)

        # Model an explicit consumer reconciliation using the candidate's
        # rendered seeds, preserving known local policy and configuration.
        reference = self.temp_root / "historical-reconciliation-seeds"
        self.copy(reference)
        for relative in ("CLAUDE.md", "docs/index.md", "records/work-items/backlog.md"):
            content = (reference / relative).read_text(encoding="utf-8")
            if relative == "CLAUDE.md":
                content += local_marker
            (destination / relative).write_text(content, encoding="utf-8")
        config_path.write_text(
            (reference / "pyproject-doc-governance.toml").read_text(encoding="utf-8") + local_setting,
            encoding="utf-8",
        )
        run(sys.executable, "scripts/check_docs.py", cwd=destination)
        run(sys.executable, "scripts/bootstrap_agents.py", "--check", cwd=destination)
        self.assertIn(local_marker, constitution.read_text(encoding="utf-8"))
        self.assertIn(local_marker, glossary.read_text(encoding="utf-8"))
        self.assertIn(local_setting, config_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
