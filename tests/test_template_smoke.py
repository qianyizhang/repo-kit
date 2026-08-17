from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
COPIER_VERSION = "9.17.1"
FIXTURE_V1 = "fixture-v1"
FIXTURE_V2 = "fixture-v2"
V2_MARKER = "<!-- repo-kit-smoke-v2 -->"
SEED_V2_MARKER = "# repo-kit-smoke-seed-v2"

SEEDED_PATHS = (
    "CLAUDE.md",
    "docs/index.md",
    "docs/glossary/ddd.md",
    "records/work-items/backlog.md",
    "pyproject-doc-governance.toml",
    ".codex/skills/explain-layman/references/repo-bindings.md",
)


class TemplateOwnershipContractTest(unittest.TestCase):
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

        # Snapshot the Git index: staged release content, never arbitrary
        # unstaged or untracked files from the live worktree.
        prefix = f"--prefix={cls.source}{os.sep}"
        run("git", "checkout-index", "--all", prefix, cwd=ROOT)
        run("git", "init", cwd=cls.source)
        run("git", "config", "user.name", "repo-kit smoke", cwd=cls.source)
        run("git", "config", "user.email", "smoke@repo-kit.invalid", cwd=cls.source)
        run("git", "add", ".", cwd=cls.source)
        run("git", "commit", "-m", "fixture v1", cwd=cls.source)
        run("git", "tag", FIXTURE_V1, cwd=cls.source)

        cls.skill_paths = tuple(sorted((cls.source / "template" / ".codex" / "skills").glob("*/SKILL.md")))
        for path in cls.skill_paths:
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

    def test_update_manages_skill_cores_and_preserves_bindings(self) -> None:
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
        for source_path in self.skill_paths:
            relative = source_path.relative_to(self.source / "template")
            self.assertIn(V2_MARKER, (destination / relative).read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
