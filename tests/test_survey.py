from __future__ import annotations

import contextlib
import importlib.util
import io
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).parents[1]
SPEC = importlib.util.spec_from_file_location(
    "repo_kit_survey", ROOT / ".codex/skills/maintain-repo-kit/scripts/survey.py"
)
assert SPEC and SPEC.loader
survey = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = survey
SPEC.loader.exec_module(survey)


class SurveyTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.parent = Path(self.temp.name).resolve()
        self.repo = self.parent / "kit"
        self.consumer = self.parent / "consumer"
        for repo in (self.repo, self.consumer):
            repo.mkdir()
            self.git(repo, "init", "-b", "main")
            self.git(repo, "config", "user.name", "Survey fixture")
            self.git(repo, "config", "user.email", "survey@repo-kit.invalid")
        self.write(self.repo, "copier.yml", "_skip_if_exists:\n  - CLAUDE.md\n  - binding.md\n")
        self.write(self.repo, "template/CLAUDE.md.jinja", "Constitution for {{ project_name }}\n")
        self.write(self.repo, "template/binding.md", "Kit fallback\n")
        self.write(self.repo, "template/binding.md.jinja", "Binding for {{ project_name }}\n")
        self.write(self.repo, "template/scripts/check.py", "# managed v1\n")
        self.commit(self.repo)
        self.git(self.repo, "tag", "baseline")
        self.write(self.consumer, ".copier-answers.yml", f"_commit: baseline\n_src_path: {self.repo}\n")
        self.write(self.consumer, "CLAUDE.md", "Consumer-specific policy\n")
        self.write(self.consumer, "binding.md", "Consumer-specific binding\n")
        self.write(self.consumer, "scripts/check.py", "# managed v1\n")
        self.commit(self.consumer)

    @staticmethod
    def git(repo: Path, *args: str) -> str:
        return subprocess.check_output(["git", "-C", str(repo), *args], text=True, stderr=subprocess.PIPE).strip()

    @staticmethod
    def write(repo: Path, relative: str, content: str) -> None:
        path = repo / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def commit(self, repo: Path) -> None:
        self.git(repo, "add", ".")
        self.git(repo, "commit", "-m", "fixture")

    def capture_consumer(self) -> tuple[bool, str]:
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            complete = survey.survey_consumer(self.repo, self.consumer)
        return complete, output.getvalue()

    def test_rendered_bindings_are_explicitly_unassessed_without_fallback_noise(self) -> None:
        complete, output = self.capture_consumer()
        self.assertTrue(complete)
        self.assertIn("Seeded/local deltas needing review: none", output)
        self.assertIn(
            "Rendered outputs not compared (manual binding review required): `CLAUDE.md`, `binding.md`", output
        )
        self.assertEqual(survey.template_outputs(self.repo, "HEAD")["binding.md"], "template/binding.md.jinja")

    def test_unstaged_and_staged_kit_changes_do_not_contaminate_committed_comparison(self) -> None:
        self.write(self.repo, "template/scripts/check.py", "# unstaged v2\n")
        self.write(self.repo, "copier.yml", "_skip_if_exists:\n  - scripts/check.py\n")
        _, output = self.capture_consumer()
        self.assertIn("Managed drift from committed kit HEAD: none", output)
        self.git(self.repo, "add", ".")
        _, output = self.capture_consumer()
        self.assertIn("Managed drift from committed kit HEAD: none", output)
        self.assertIn("Rendered outputs not compared", output)

    def test_update_lag_is_distinct_from_consumer_authorship(self) -> None:
        self.write(self.repo, "template/scripts/check.py", "# committed v2\n")
        self.commit(self.repo)
        _, output = self.capture_consumer()
        self.assertIn("Managed deltas from baseline: none", output)
        self.assertIn("Managed drift from committed kit HEAD: `scripts/check.py`", output)
        self.write(self.consumer, "scripts/check.py", "# local customization\n")
        _, output = self.capture_consumer()
        self.assertIn("Managed deltas from baseline: `scripts/check.py`", output)

    def test_deleted_live_source_does_not_break_committed_comparison(self) -> None:
        (self.repo / "template/scripts/check.py").unlink()
        complete, output = self.capture_consumer()
        self.assertTrue(complete)
        self.assertIn("Managed drift from committed kit HEAD: none", output)

    def test_detached_worktree_is_reported_with_dirty_state(self) -> None:
        detached = self.parent / "detached"
        self.git(self.repo, "worktree", "add", "--detach", str(detached), "HEAD")
        self.write(detached, "untracked.txt", "retained work\n")
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            survey.survey_branches(self.repo, "main")
        self.assertIn("detached@", output.getvalue())
        self.assertIn(f"`{detached}` | yes | inspect retained work", output.getvalue())

    def test_unavailable_baseline_is_incomplete(self) -> None:
        self.write(self.consumer, ".copier-answers.yml", "_commit: missing-ref\n")
        complete, output = self.capture_consumer()
        self.assertFalse(complete)
        self.assertIn("unavailable locally", output)

    def test_main_continues_after_incomplete_consumer_and_returns_failure(self) -> None:
        other = self.parent / "other"
        with (
            patch.object(sys, "argv", ["survey.py", "--repo", str(self.repo)]),
            patch.object(survey, "consumers", return_value=[self.consumer, other]),
            patch.object(survey, "survey_consumer", side_effect=[OSError("unreadable fixture"), True]) as inspect,
            contextlib.redirect_stdout(io.StringIO()) as output,
        ):
            self.assertEqual(survey.main(), 1)
        self.assertEqual(inspect.call_count, 2)
        self.assertIn("Survey incomplete", output.getvalue())


if __name__ == "__main__":
    unittest.main()
