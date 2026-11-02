from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).parents[1]
SPEC = importlib.util.spec_from_file_location("issue_queue", ROOT / "scripts/issue_queue.py")
queue = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = queue
SPEC.loader.exec_module(queue)
FIXTURE = ROOT / "tests/fixtures/issue_queue.json"
NOW = queue.timestamp("2026-10-30T12:00:00Z")


class IssueQueueTest(unittest.TestCase):
    def setUp(self):
        self.snapshot = json.loads(FIXTURE.read_text())
        self.block = json.loads(queue.metadata_blocks(self.snapshot["issues"][0]["body"])[0])
        self.scope = copy.deepcopy(self.block["scopes"][1])
        self.scope["dependencies"] = []
        self.block["scopes"] = [self.scope]
        self.snapshot["issues"] = self.snapshot["issues"][:1]

    def evaluate(self, **kwargs):
        self.snapshot["issues"][0]["body"] = "```repo-kit-queue\n" + json.dumps(self.block) + "\n```"
        return queue.evaluate(self.snapshot, NOW, **kwargs)

    def test_fixture_selects_build_despite_parked_publication(self):
        rows = queue.evaluate(json.loads(FIXTURE.read_text()), NOW)
        self.assertEqual(["qianyizhang/repo-kit#7/build"], [r.key for r in rows if r.eligible])
        publication = next(r for r in rows if r.scope == "publish")
        self.assertEqual("approval-blocked", publication.state)
        self.assertIn("action-blocked", ";".join(publication.problems))
        unknown = next(r for r in rows if r.issue.endswith("#101"))
        self.assertEqual("unknown", unknown.state)
        self.assertEqual(["missing-metadata"], unknown.problems)

    def test_missing_metadata_is_unknown_even_with_ready_labels_and_prose(self):
        self.snapshot["issues"][0].update(
            body="Ready. No PR. Nobody assigned.", labels=[{"name": "ready"}], assignees=[]
        )
        rows = queue.evaluate(self.snapshot, NOW)
        self.assertEqual("unknown", rows[0].state)
        self.assertFalse(rows[0].eligible)

    def test_missing_required_receipt_fields_cannot_select(self):
        for key in (
            "state",
            "priority",
            "owner",
            "task",
            "source",
            "artifact",
            "last_progress",
            "assumptions",
            "acceptance",
            "readiness",
            "evidence",
            "dependencies",
            "blockers",
            "ci",
            "action",
            "target",
        ):
            with self.subTest(key=key):
                original = self.scope.pop(key)
                self.assertFalse(self.evaluate()[0].eligible)
                self.scope[key] = original

    def test_multiple_blocks_and_duplicate_json_keys_fail_closed(self):
        self.evaluate()
        body = self.snapshot["issues"][0]["body"]
        self.snapshot["issues"][0]["body"] = body + "\n" + body
        self.assertIn("conflicting-metadata", queue.evaluate(self.snapshot, NOW)[0].problems[0])
        self.snapshot["issues"][0]["body"] = '```repo-kit-queue\n{"schema_version":1,"schema_version":1}\n```'
        self.assertIn("duplicate JSON key", queue.evaluate(self.snapshot, NOW)[0].problems[0])

    def test_partial_second_block_and_embedded_example_cannot_be_selected(self):
        self.evaluate()
        body = self.snapshot["issues"][0]["body"]
        for edited in (body + "\n```repo-kit-queue\n{", "````markdown\n" + body + "\n````"):
            with self.subTest(body=edited):
                self.snapshot["issues"][0]["body"] = edited
                self.assertFalse(queue.evaluate(self.snapshot, NOW)[0].eligible)

    def test_metadata_version_and_issue_binding(self):
        self.block["schema_version"] = 2
        self.assertIn("unsupported metadata", self.evaluate()[0].problems[0])
        self.block["schema_version"] = 1
        self.block["issue"] = "qianyizhang/repo-kit#8"
        self.assertIn("issue identity", self.evaluate()[0].problems[0])

    def test_unknown_and_active_owner_never_mean_idle(self):
        self.scope["owner"]["state"] = "unknown"
        self.assertIn("unknown-owner-state", self.evaluate()[0].problems)
        self.scope["owner"].update(state="active", id="worker", task_id="task")
        self.assertIn("active-owner", ";".join(self.evaluate()[0].problems))
        self.assertFalse(self.evaluate()[0].eligible)

    def test_stale_receipt_and_progress_configurable(self):
        self.scope["owner"]["observed_at"] = "2026-10-30T08:00:00Z"
        self.scope["last_progress"]["at"] = "2026-10-30T08:00:00Z"
        row = self.evaluate()[0]
        self.assertIn("stale-owner-observation", row.problems)
        self.assertIn("stale-progress", row.problems)
        self.assertTrue(self.evaluate(stale_hours=5)[0].eligible)

    def test_reused_evidence_depends_on_identity_and_assumptions_not_age(self):
        self.assertTrue(self.evaluate()[0].eligible)
        for field_name in ("artifact_identity", "source_identity", "assumptions"):
            with self.subTest(field=field_name):
                proof = self.scope["evidence"][0]
                original = proof[field_name]
                proof[field_name] = "different"
                self.assertFalse(self.evaluate()[0].eligible)
                proof[field_name] = original

    def test_all_declared_states_are_preserved(self):
        for state in queue.STATES:
            with self.subTest(state=state):
                self.scope["state"] = state
                self.assertEqual(state, self.evaluate()[0].state)
        for state in ("paused", "retired", "done", "local-unpushed", "review", "approval-blocked"):
            self.scope["state"] = state
            self.assertFalse(self.evaluate()[0].eligible)

    def test_action_only_hold_leaves_build_eligible(self):
        self.scope["blockers"] = [copy.deepcopy(self.blocker())]
        self.assertTrue(self.evaluate()[0].eligible)
        self.scope["blockers"][0]["action"] = "build"
        self.assertTrue(self.evaluate()[0].eligible)
        self.scope["blockers"][0]["target"] = self.scope["target"]
        self.assertFalse(self.evaluate()[0].eligible)

    @staticmethod
    def blocker():
        return {
            "action": "publish",
            "target": "repo:branch",
            "status": "denied",
            "reason": "review missing",
            "required": "explicit approval",
            "completed": "retained local commit",
            "artifact_identity": "retained-commit",
            "observed_at": NOW.isoformat(),
        }

    def test_dependency_done_and_matching_artifact_required(self):
        dep = copy.deepcopy(self.scope)
        dep.update(scope="preflight", task="preflight", state="done")
        self.block["scopes"].append(dep)
        self.scope["dependencies"] = [
            {"issue": self.block["issue"], "scope": "preflight", "artifact_identity": dep["artifact"]["identity"]}
        ]
        self.assertTrue(self.evaluate()[0].eligible)
        dep["state"] = "paused"
        self.assertIn("dependency-not-satisfied", ";".join(self.evaluate()[0].problems))
        dep["state"] = "done"
        self.scope["dependencies"][0]["artifact_identity"] = "other"
        self.assertIn("dependency-artifact-mismatch", ";".join(self.evaluate()[0].problems))

    def test_missing_conflicting_and_cyclic_dependencies(self):
        dep = {"issue": self.block["issue"], "scope": "missing", "artifact_identity": "other"}
        self.scope["dependencies"] = [dep]
        self.assertIn("dependency-unknown", ";".join(self.evaluate()[0].problems))
        self.scope["dependencies"].append(copy.deepcopy(dep))
        self.assertIn("conflicting-dependencies", ";".join(self.evaluate()[0].problems))
        dep["scope"] = "build"
        self.scope["dependencies"] = [dep]
        self.assertIn("dependency-cycle", self.evaluate()[0].problems)

    def test_conflicting_records_and_duplicate_assignments(self):
        other = copy.deepcopy(self.scope)
        self.block["scopes"].append(other)
        self.assertTrue(all("conflicting-records" in ";".join(r.problems) for r in self.evaluate()))
        other["scope"] = "another"
        self.assertTrue(all("duplicate-assignment: task" in ";".join(r.problems) for r in self.evaluate()))
        other["task"] = "another-task"
        for item in self.block["scopes"]:
            item["state"] = "running"
            item["owner"].update(state="active", id="one-worker", task_id="one-task")
        self.assertTrue(all("duplicate-assignment: id" in ";".join(r.problems) for r in self.evaluate()))

    def test_priority_then_identity_deterministically_order_selection(self):
        other = copy.deepcopy(self.scope)
        other.update(scope="aaa", task="aaa", priority=0)
        self.block["scopes"].append(other)
        self.assertEqual("aaa", self.evaluate()[0].scope)
        other["priority"] = self.scope["priority"]
        self.assertEqual("aaa", self.evaluate()[0].scope)
        self.block["scopes"].reverse()
        self.assertEqual("aaa", self.evaluate()[0].scope)

    def ci(self):
        sha = self.scope["artifact"]["identity"].split("@")[-1]
        self.scope["ci"] = {"pr": 6, "workflows": [12]}
        self.snapshot["pull_requests"] = [
            {"number": 6, "head": {"sha": sha, "ref": "candidate", "repo": {"full_name": "qianyizhang/repo-kit"}}}
        ]
        run = {
            "id": 101,
            "workflow_id": 12,
            "head_sha": sha,
            "run_number": 1,
            "run_attempt": 1,
            "status": "completed",
            "conclusion": "success",
            "created_at": NOW.isoformat(),
            "updated_at": NOW.isoformat(),
            "run_started_at": NOW.isoformat(),
            "event": "pull_request",
            "pull_requests": [{"number": 6}],
            "head_branch": "candidate",
            "head_repository": {"full_name": "qianyizhang/repo-kit"},
        }
        self.snapshot["workflow_runs"] = [run]
        return run

    def test_ci_requires_current_head_and_latest_run(self):
        run = self.ci()
        self.assertTrue(self.evaluate()[0].eligible)
        run["head_sha"] = "0" * 40
        self.assertIn("ci-missing-current-head", ";".join(self.evaluate()[0].problems))
        run["head_sha"] = self.snapshot["pull_requests"][0]["head"]["sha"]
        latest = {**run, "id": 102, "run_number": 2, "conclusion": "failure"}
        self.snapshot["workflow_runs"].append(latest)
        row = self.evaluate()[0]
        self.assertFalse(row.eligible)
        self.assertEqual(102, row.ci[0]["run_id"])
        latest.update(status="in_progress", conclusion=None)
        self.assertFalse(self.evaluate()[0].eligible)

    def test_ci_latest_rerun_and_stale_observation(self):
        run = self.ci()
        self.snapshot["workflow_runs"].append({**run, "run_attempt": 2, "conclusion": "failure"})
        self.assertFalse(self.evaluate()[0].eligible)
        self.snapshot["workflow_runs"] = [run]
        self.snapshot["observed_at"] = "2026-10-30T08:00:00Z"
        self.assertIn("stale-ci-observation", self.evaluate()[0].problems)

    def test_malformed_nested_metadata_is_diagnostic_not_traceback(self):
        for key in ("artifact", "source", "owner", "last_progress", "dependencies", "blockers", "evidence", "ci"):
            original = self.scope[key]
            for value in ("invalid", 4, ["invalid"], True):
                with self.subTest(key=key, value=value):
                    self.scope[key] = value
                    self.assertFalse(self.evaluate()[0].eligible)
            self.scope[key] = original

    def test_ci_ignores_other_pr_branch_repository_and_privileged_base_runs(self):
        for changes in (
            {"pull_requests": [{"number": 99}]},
            {"head_branch": "other"},
            {"head_repository": {"full_name": "other/repo"}},
            {"event": "pull_request_target"},
        ):
            with self.subTest(changes=changes):
                run = self.ci()
                run.update(changes)
                self.assertFalse(self.evaluate()[0].eligible)

    def test_observations_cannot_postdate_the_snapshot(self):
        self.snapshot["observed_at"] = "2026-10-30T11:59:00Z"
        self.assertFalse(self.evaluate()[0].eligible)

    def test_duplicate_issue_snapshots_conflict_even_for_disjoint_scopes(self):
        self.evaluate()
        other_issue = copy.deepcopy(self.snapshot["issues"][0])
        other_block = copy.deepcopy(self.block)
        other_block["scopes"][0].update(scope="other", task="other")
        other_issue["body"] = "```repo-kit-queue\n" + json.dumps(other_block) + "\n```"
        self.snapshot["issues"].append(other_issue)
        self.assertFalse(any(r.eligible for r in queue.evaluate(self.snapshot, NOW)))

    def test_exact_action_hold_applies_across_scopes_and_issues(self):
        held = copy.deepcopy(self.scope)
        held.update(scope="held", task="held-task", state="approval-blocked")
        held["blockers"] = [{**self.blocker(), "action": self.scope["action"], "target": self.scope["target"]}]
        self.block["scopes"].append(held)
        row = next(r for r in self.evaluate() if r.scope == "build")
        self.assertFalse(row.eligible)
        self.scope["target"] = "independent-target"
        self.assertTrue(next(r for r in self.evaluate() if r.scope == "build").eligible)
        self.scope["target"] = held["target"]
        self.scope["action"] = "independent-action"
        self.assertTrue(next(r for r in self.evaluate() if r.scope == "build").eligible)
        self.scope["action"] = held["action"]
        self.block["scopes"] = [self.scope]
        other = copy.deepcopy(self.snapshot["issues"][0])
        other.update(number=8, html_url="https://github.com/qianyizhang/repo-kit/issues/8")
        other["body"] = (
            "```repo-kit-queue\n"
            + json.dumps({"schema_version": 1, "issue": "qianyizhang/repo-kit#8", "scopes": [held]})
            + "\n```"
        )
        self.snapshot["issues"].append(other)
        self.assertFalse(next(r for r in self.evaluate() if r.scope == "build").eligible)

    def test_conflicting_active_released_owner_observations_need_reconciliation(self):
        active = copy.deepcopy(self.scope)
        active.update(scope="running", task="running-task", state="running")
        active["owner"].update(state="active", id="worker", task_id="worker-task", observed_at="2026-10-30T11:55:00Z")
        self.scope["owner"].update(
            state="released", id="worker", task_id="worker-task", observed_at="2026-10-30T11:56:00Z"
        )
        self.block["scopes"].append(active)
        rows = self.evaluate()
        self.assertTrue(all("conflicting-owner-observations" in ";".join(r.problems) for r in rows))
        self.assertFalse(any(r.eligible for r in rows))
        self.scope["owner"]["task_id"] = "previous-task"
        self.assertTrue(next(r for r in self.evaluate() if r.scope == "build").eligible)

    def test_future_snapshot_is_invalid_even_without_ci(self):
        self.snapshot["observed_at"] = "2026-10-31T12:00:00Z"
        with self.assertRaisesRegex(ValueError, "snapshot observation is in the future"):
            self.evaluate()

    def test_latest_attempt_chronology_includes_rerun_of_an_older_run(self):
        older = self.ci()
        older.update(
            created_at="2026-10-30T11:00:00Z",
            run_attempt=2,
            run_started_at="2026-10-30T11:55:00Z",
            updated_at="2026-10-30T11:59:00Z",
            conclusion="failure",
        )
        newer = {
            **older,
            "id": 102,
            "run_number": 2,
            "run_attempt": 1,
            "created_at": "2026-10-30T11:45:00Z",
            "run_started_at": "2026-10-30T11:45:00Z",
            "updated_at": "2026-10-30T11:50:00Z",
            "conclusion": "success",
        }
        self.snapshot["workflow_runs"].append(newer)
        row = self.evaluate()[0]
        self.assertFalse(row.eligible)
        self.assertEqual(101, row.ci[0]["run_id"])
        older["conclusion"] = "success"
        self.assertTrue(self.evaluate()[0].eligible)
        older.pop("run_started_at")
        self.assertFalse(self.evaluate()[0].eligible)

    def test_contradictory_ci_run_identity_cannot_select_a_successful_copy(self):
        run = self.ci()
        self.snapshot["workflow_runs"].append({**run, "run_number": 2})
        row = self.evaluate()[0]
        self.assertFalse(row.eligible)
        self.assertIn("conflicting CI run identity", ";".join(row.problems))
        self.snapshot["workflow_runs"] = [run, {**run, "id": 102}]
        row = self.evaluate()[0]
        self.assertFalse(row.eligible)
        self.assertIn("conflicting CI run number", ";".join(row.problems))

    def test_conflicting_ci_context_is_not_discarded_by_relevance_filter(self):
        for changes in (
            {"head_branch": "other"},
            {"event": "pull_request_target"},
            {"head_repository": {"full_name": "other/repository"}},
        ):
            with self.subTest(changes=changes):
                run = self.ci()
                self.snapshot["workflow_runs"].append({**run, **changes, "conclusion": "failure"})
                row = self.evaluate()[0]
                self.assertFalse(row.eligible)
                self.assertIn("conflicting CI run identity", ";".join(row.problems))

    def test_cli_fixture_commands_are_credential_free_and_do_not_write(self):
        before = FIXTURE.read_bytes()
        for command, status in (("queue", 0), ("status", 0), ("next", 0), ("check", 1)):
            result = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts/issue_queue.py"),
                    command,
                    "--fixture",
                    str(FIXTURE),
                    "--now",
                    NOW.isoformat(),
                    "--json",
                ],
                capture_output=True,
                text=True,
                env={"PATH": "/nonexistent"},
            )
            self.assertEqual(status, result.returncode, result.stderr)
            data = json.loads(result.stdout)
            self.assertTrue(data["dry_run"])
            if command == "next":
                self.assertEqual("qianyizhang/repo-kit#7/build", data["selected"])
            if command == "status":
                self.assertIn("retired", [r["state"] for r in data["scopes"]])
            if command == "queue":
                self.assertNotIn("retired", [r["state"] for r in data["scopes"]])
        self.assertEqual(before, FIXTURE.read_bytes())

    def test_adapter_only_invokes_paginated_get_and_stops_on_denial(self):
        self.evaluate()
        with patch.object(queue.subprocess, "run") as run:
            run.return_value = subprocess.CompletedProcess([], 0, json.dumps([self.snapshot["issues"]]), "")
            result = queue.github_snapshot("qianyizhang/repo-kit")
            self.assertEqual(1, len(result["issues"]))
            self.assertEqual(
                [
                    "gh",
                    "api",
                    "--method",
                    "GET",
                    "repos/qianyizhang/repo-kit/issues?state=all&per_page=100",
                    "--paginate",
                    "--slurp",
                ],
                run.call_args.args[0],
            )
            run.return_value = subprocess.CompletedProcess([], 1, "", "Forbidden")
            with self.assertRaisesRegex(ValueError, "Forbidden"):
                queue.github_snapshot("qianyizhang/repo-kit")
            self.assertEqual(2, run.call_count)


if __name__ == "__main__":
    unittest.main()
