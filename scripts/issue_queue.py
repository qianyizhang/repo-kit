#!/usr/bin/env python3
"""Read-only, issue-backed queue recommendations. No dispatch or local state store."""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

STATES = {"ready", "running", "local-unpushed", "review", "approval-blocked", "paused", "retired", "done"}
INACTIVE = {"paused", "retired", "done"}
REPO = re.compile(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\Z")
SCOPE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*\Z")
FENCE = re.compile(r"^(`{3,}|~{3,})(.*)$")


def metadata_blocks(body: str) -> list[str]:
    """Read column-zero fences, excluding examples nested in other fenced blocks."""
    blocks, lines = [], []
    fence, metadata = "", False
    for line in body.splitlines():
        match = FENCE.fullmatch(line)
        if not fence:
            if match:
                fence = match[1]
                metadata = fence == "```" and match[2].strip() == "repo-kit-queue"
                lines = []
        elif match and match[1][0] == fence[0] and len(match[1]) >= len(fence) and not match[2].strip():
            if metadata:
                blocks.append("\n".join(lines))
            fence, metadata = "", False
        elif metadata:
            lines.append(line)
    if metadata:
        raise ValueError("unterminated metadata block")
    return blocks


def timestamp(value: object) -> datetime:
    if not isinstance(value, str):
        raise ValueError("timestamp must be an ISO 8601 string with timezone")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("invalid timestamp") from exc
    if result.tzinfo is None:
        raise ValueError("timestamp needs a timezone")
    return result


def text(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def integer(value: object) -> bool:
    return type(value) is int and value >= 0


def mapping(value: object) -> dict:
    if not isinstance(value, dict):
        raise ValueError("expected an object")
    return value


def sequence(value: object) -> list:
    if not isinstance(value, list):
        raise ValueError("expected an array")
    return value


def unique_keys(pairs: list[tuple]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(value: str) -> object:
    return json.loads(value, object_pairs_hook=unique_keys)


@dataclass
class Scope:
    issue: str
    scope: str
    issue_state: str
    receipt: dict
    source: dict
    problems: list[str] = field(default_factory=list)
    ci: list[dict] = field(default_factory=list)
    eligible: bool = False

    @property
    def key(self) -> str:
        return f"{self.issue}/{self.scope}"

    @property
    def state(self) -> str:
        state = self.receipt.get("state")
        return state if isinstance(state, str) and state in STATES else "unknown"

    @property
    def priority(self) -> int | None:
        value = self.receipt.get("priority")
        return value if integer(value) else None

    @property
    def artifact_identity(self) -> str | None:
        artifact = self.receipt.get("artifact")
        return artifact.get("identity") if isinstance(artifact, dict) else None

    def problem(self, reason: str) -> None:
        if reason not in self.problems:
            self.problems.append(reason)

    def output(self) -> dict:
        return {**asdict(self), "key": self.key, "state": self.state, "priority": self.priority}


def parse_issues(snapshot: dict) -> list[Scope]:
    repo = snapshot.get("repository")
    if not isinstance(repo, str) or not REPO.fullmatch(repo):
        raise ValueError("snapshot needs repository owner/name")
    if type(snapshot.get("schema_version")) is not int or snapshot["schema_version"] != 1:
        raise ValueError("unsupported snapshot schema_version (expected 1)")
    timestamp(snapshot.get("observed_at"))
    rows = []
    seen_issues = set()
    duplicate_issues = set()
    for issue in sequence(snapshot.get("issues")):
        issue = mapping(issue)
        if "pull_request" in issue:
            continue
        number = issue.get("number")
        if not integer(number) or number == 0:
            raise ValueError("issue needs a positive number")
        identity = f"{repo}#{number}"
        if identity in seen_issues:
            duplicate_issues.add(identity)
        seen_issues.add(identity)
        source = {
            "url": issue.get("html_url"),
            "updated_at": issue.get("updated_at"),
            "observed_at": snapshot["observed_at"],
        }
        state = issue.get("state", "unknown")
        body = issue.get("body") or ""
        if not isinstance(body, str):
            raise ValueError(f"{identity}: issue body must be text or null")
        try:
            blocks = metadata_blocks(body)
        except ValueError as exc:
            rows.append(Scope(identity, "?", state, {}, source, [f"invalid-metadata: {exc}"]))
            continue
        if len(blocks) != 1:
            reason = "missing-metadata" if not blocks else "conflicting-metadata: multiple blocks"
            rows.append(Scope(identity, "?", state, {}, source, [reason]))
            continue
        try:
            block = mapping(read_json(blocks[0]))
            if type(block.get("schema_version")) is not int or block["schema_version"] != 1:
                raise ValueError("unsupported metadata schema_version (expected 1)")
            if block.get("issue") != identity:
                raise ValueError("issue identity does not match enclosing GitHub issue")
            scopes = sequence(block.get("scopes"))
            if not scopes:
                raise ValueError("scopes must not be empty")
            for value in scopes:
                data = mapping(value)
                name = data.get("scope")
                if not isinstance(name, str) or not SCOPE.fullmatch(name):
                    raise ValueError("scope needs a stable identifier")
            rows.extend(Scope(identity, data["scope"], state, data, source) for data in scopes)
        except (ValueError, TypeError) as exc:
            rows.append(Scope(identity, "?", state, {}, source, [f"invalid-metadata: {exc}"]))
    for row in rows:
        if row.issue in duplicate_issues:
            row.problem("conflicting-records: duplicate issue observation")
    return rows


def validate(row: Scope, now: datetime, stale: timedelta) -> None:
    data = row.receipt
    if not data:
        return
    if row.state == "unknown":
        row.problem("unknown-state")
    if row.issue_state not in {"open", "closed"}:
        row.problem("unknown-issue-state")
    if row.issue_state == "closed" and row.state not in {"done", "retired"}:
        row.problem("conflicting-issue-state: closed issue has unfinished scope")
    if row.priority is None:
        row.problem("missing-priority: expected nonnegative integer")
    for key in ("task", "action", "target", "assumptions", "acceptance"):
        if not text(data.get(key)):
            row.problem(f"missing-{key}")
    for key in ("source", "artifact"):
        value = data.get(key)
        if not isinstance(value, dict) or not all(text(value.get(k)) for k in ("identity", "location")):
            row.problem(f"missing-{key}-identity")
    if data.get("readiness") != "ready":
        row.problem("source-evidence-readiness-unknown" if data.get("readiness") != "blocked" else "readiness-blocked")

    def age(value: object, label: str, enforce_stale: bool = True) -> None:
        try:
            observed = timestamp(value)
            if observed > min(now, timestamp(row.source["observed_at"])):
                row.problem(f"future-{label}")
            elif enforce_stale and row.state not in INACTIVE and now - observed > stale:
                row.problem(f"stale-{label}")
        except ValueError:
            row.problem(f"missing-{label}-timestamp")

    owner = data.get("owner")
    if not isinstance(owner, dict):
        row.problem("unknown-owner-state")
    else:
        owner_state = owner.get("state")
        if owner_state not in ("unassigned", "active", "released"):
            row.problem("unknown-owner-state")
        if owner_state == "unassigned":
            if "id" not in owner or "task_id" not in owner or owner["id"] is not None or owner["task_id"] is not None:
                row.problem("conflicting-owner: unassigned requires explicit null id and task_id")
        elif owner_state in ("active", "released") and not all(text(owner.get(k)) for k in ("id", "task_id")):
            row.problem("missing-owner-task-identity")
        if row.state == "running" and owner_state != "active":
            row.problem("conflicting-owner: running scope needs active owner")
        if row.state == "ready" and owner_state == "active":
            row.problem("active-owner: scope already assigned")
        if row.state in INACTIVE and owner_state == "active":
            row.problem("conflicting-owner: inactive scope still assigned")
        age(owner.get("observed_at"), "owner-observation")
    progress = data.get("last_progress")
    if not isinstance(progress, dict) or not text(progress.get("summary")):
        row.problem("missing-meaningful-progress")
    else:
        age(progress.get("at"), "progress")
        if progress.get("artifact_identity") != row.artifact_identity:
            row.problem("progress-artifact-mismatch")

    evidence = data.get("evidence")
    if not isinstance(evidence, list) or not evidence:
        row.problem("missing-evidence")
    else:
        # Age alone does not invalidate an unchanged artifact and its assumptions.
        for proof in evidence:
            if not isinstance(proof, dict) or not text(proof.get("location")) or not text(proof.get("check")):
                row.problem("invalid-evidence")
                continue
            age(proof.get("observed_at"), "evidence", enforce_stale=False)
            if proof.get("result") != "pass":
                row.problem("evidence-not-passed")
            for key in ("source", "artifact"):
                expected = data.get(key)
                if not isinstance(expected, dict) or proof.get(f"{key}_identity") != expected.get("identity"):
                    row.problem(f"evidence-{key}-mismatch")
            if proof.get("assumptions") != data.get("assumptions"):
                row.problem("evidence-assumptions-mismatch")

    deps = data.get("dependencies")
    if not isinstance(deps, list):
        row.problem("unknown-dependencies: explicit array required")
    else:
        seen = set()
        for dep in deps:
            if not isinstance(dep, dict) or not all(text(dep.get(k)) for k in ("issue", "scope", "artifact_identity")):
                row.problem("invalid-dependency")
                continue
            key = (dep["issue"], dep["scope"])
            if key in seen:
                row.problem("conflicting-dependencies: repeated scope")
            seen.add(key)

    blockers = data.get("blockers")
    if not isinstance(blockers, list):
        row.problem("unknown-blockers: explicit array required")
    else:
        for blocker in blockers:
            if (
                not isinstance(blocker, dict)
                or not all(
                    text(blocker.get(k))
                    for k in ("action", "target", "reason", "status", "required", "completed", "artifact_identity")
                )
                or blocker.get("status") not in ("pending", "denied", "uncertain")
            ):
                row.problem("invalid-action-blocker")
                continue
            age(blocker.get("observed_at"), "blocker", enforce_stale=False)
            if (blocker["action"], blocker["target"]) == (data.get("action"), data.get("target")):
                row.problem(f"action-blocked: {blocker['action']} {blocker['status']} ({blocker['target']})")
        if row.state == "approval-blocked" and not any(
            isinstance(b, dict) and (b.get("action"), b.get("target")) == (data.get("action"), data.get("target"))
            for b in blockers
        ):
            row.problem("missing-action-blocker")
    if "ci" not in data:
        row.problem("unknown-ci-requirement: use null or explicit PR/workflows")


def check_ci(row: Scope, snapshot: dict, now: datetime, stale: timedelta) -> None:
    required = row.receipt.get("ci")
    if required is None:
        return
    if not isinstance(required, dict) or not integer(required.get("pr")) or required["pr"] == 0:
        row.problem("invalid-ci-requirement")
        return
    workflows = required.get("workflows")
    if not isinstance(workflows, list) or not workflows or any(not integer(w) or not w for w in workflows):
        row.problem("invalid-ci-workflows")
        return
    try:
        observed = timestamp(snapshot.get("observed_at"))
        if observed > now or now - observed > stale:
            row.problem("stale-ci-observation")
        prs = [p for p in sequence(snapshot.get("pull_requests", [])) if mapping(p).get("number") == required["pr"]]
        if len(prs) != 1:
            raise ValueError("missing or conflicting PR observation")
        pr = prs[0]
        head = mapping(pr.get("head"))
        sha = head.get("sha")
        if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{40}", sha):
            raise ValueError("missing current PR head SHA")
        head_repo = mapping(head.get("repo")).get("full_name")
        if not text(head.get("ref")) or not text(head_repo):
            raise ValueError("missing PR branch/repository identity")
        if row.artifact_identity != f"git:{head_repo}@{sha}":
            row.problem("ci-artifact-head-mismatch")
        runs = [mapping(run) for run in sequence(snapshot.get("workflow_runs", []))]

        def matches(run: dict) -> bool:
            if run.get("head_sha") != sha or run.get("head_branch") != head["ref"]:
                return False
            if mapping(run.get("head_repository")).get("full_name") != head_repo:
                return False
            if run.get("event") == "push":
                return True
            return run.get("event") == "pull_request" and any(
                mapping(p).get("number") == required["pr"] for p in sequence(run.get("pull_requests"))
            )

        for workflow in sorted(set(workflows)):
            relevant = [r for r in runs if r.get("workflow_id") == workflow and matches(r)]
            if not relevant:
                row.problem(f"ci-missing-current-head: workflow {workflow}")
                continue
            # A rerun retains its run ID/number and increments run_attempt.
            for run in relevant:
                if not all(integer(run.get(k)) and run[k] > 0 for k in ("id", "run_number", "run_attempt")):
                    raise ValueError("missing run identity/order")
                timestamp(run.get("created_at"))
                timestamp(run.get("updated_at"))
            latest = max(relevant, key=lambda r: (r["run_number"], r["run_attempt"]))
            peers = [
                r
                for r in relevant
                if r["run_number"] == latest["run_number"] and r["run_attempt"] == latest["run_attempt"]
            ]
            if len(peers) != 1:
                row.problem(f"ci-conflicting-latest-run: workflow {workflow}")
            row.ci.append(
                {
                    "workflow_id": workflow,
                    "head_sha": sha,
                    "run_id": latest["id"],
                    "run_attempt": latest["run_attempt"],
                    "status": latest.get("status"),
                    "conclusion": latest.get("conclusion"),
                    "url": latest.get("html_url"),
                }
            )
            if timestamp(latest["updated_at"]) > observed:
                row.problem(f"ci-future-run: workflow {workflow}")
            if latest.get("status") != "completed" or latest.get("conclusion") != "success":
                row.problem(f"ci-not-passed: workflow {workflow} latest run {latest['id']}")
    except (ValueError, TypeError) as exc:
        row.problem(f"ci-unknown: {exc}")


def evaluate(snapshot: dict, now: datetime, stale_hours: float = 2) -> list[Scope]:
    if not math.isfinite(stale_hours) or stale_hours <= 0:
        raise ValueError("stale-hours must be a positive finite number")
    stale = timedelta(hours=stale_hours)
    rows = parse_issues(snapshot)
    index = defaultdict(list)
    assignments = defaultdict(list)
    for row in rows:
        validate(row, now, stale)
        check_ci(row, snapshot, now, stale)
        index[row.key].append(row)
        if row.state not in INACTIVE and row.receipt:
            task = row.receipt.get("task")
            if text(task):
                assignments[("task", task)].append(row)
            owner = row.receipt.get("owner")
            if isinstance(owner, dict) and owner.get("state") == "active":
                for field_name in ("id", "task_id"):
                    if text(owner.get(field_name)):
                        assignments[(field_name, owner[field_name])].append(row)
    for group in index.values():
        if len(group) > 1:
            for row in group:
                row.problem("conflicting-records: duplicate issue/scope")
    for (kind, identity), group in assignments.items():
        if len(group) > 1:
            for row in group:
                row.problem(f"duplicate-assignment: {kind} {identity}")

    # Resolve dependencies recursively; cycles and uncertain completion never satisfy a dependency.
    visited, visiting = set(), set()

    def resolve(row: Scope) -> None:
        if id(row) in visited:
            return
        if id(row) in visiting:
            row.problem("dependency-cycle")
            return
        visiting.add(id(row))
        deps = row.receipt.get("dependencies")
        for dep in deps if isinstance(deps, list) else []:
            if not isinstance(dep, dict) or not all(text(dep.get(k)) for k in ("issue", "scope", "artifact_identity")):
                continue
            key = f"{dep['issue']}/{dep['scope']}"
            targets = index.get(key, [])
            if len(targets) != 1:
                row.problem(f"dependency-unknown: {key}")
                continue
            target = targets[0]
            resolve(target)
            if target.state != "done" or target.problems:
                row.problem(f"dependency-not-satisfied: {key}")
            if target.artifact_identity != dep["artifact_identity"]:
                row.problem(f"dependency-artifact-mismatch: {key}")
        visiting.remove(id(row))
        visited.add(id(row))

    for row in rows:
        resolve(row)
        row.eligible = row.state == "ready" and row.issue_state == "open" and not row.problems
    return sorted(rows, key=lambda r: (r.priority if r.priority is not None else math.inf, r.issue, r.scope))


def gh_get(endpoint: str, paginated: bool = False) -> object:
    """Only internal, relative GitHub REST read endpoints; never a shell or auth command."""
    command = ["gh", "api", "--method", "GET", endpoint]
    if paginated:
        command.extend(["--paginate", "--slurp"])
    result = subprocess.run(command, text=True, capture_output=True, timeout=60, check=False)
    if result.returncode:
        raise ValueError(f"GitHub read failed for {endpoint}: {result.stderr.strip()}")
    return read_json(result.stdout)


def github_snapshot(repo: str) -> dict:
    if not REPO.fullmatch(repo):
        raise ValueError("repository must be owner/name")
    pages = sequence(gh_get(f"repos/{repo}/issues?state=all&per_page=100", paginated=True))
    issues = [mapping(issue) for page in pages for issue in sequence(page)]
    snapshot = {
        "schema_version": 1,
        "repository": repo,
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "issues": issues,
        "pull_requests": [],
        "workflow_runs": [],
    }
    required_prs = set()
    for row in parse_issues(snapshot):
        ci = row.receipt.get("ci")
        if isinstance(ci, dict) and integer(ci.get("pr")) and ci["pr"] > 0:
            required_prs.add(ci["pr"])
    heads = set()
    for number in sorted(required_prs):
        pr = mapping(gh_get(f"repos/{repo}/pulls/{number}"))
        sha = mapping(pr.get("head")).get("sha")
        if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{40}", sha):
            raise ValueError(f"PR {number} has no valid head SHA")
        snapshot["pull_requests"].append(pr)
        if sha not in heads:
            pages = sequence(gh_get(f"repos/{repo}/actions/runs?head_sha={sha}&per_page=100", paginated=True))
            runs = [mapping(run) for page in pages for run in sequence(mapping(page).get("workflow_runs"))]
            if any(mapping(page).get("total_count", 0) > len(runs) for page in pages):
                raise ValueError("incomplete workflow history; cannot establish latest run")
            snapshot["workflow_runs"].extend(runs)
            heads.add(sha)
        # Do not bless CI if a force-push raced the read. This remains a snapshot, not a lock.
        current = mapping(gh_get(f"repos/{repo}/pulls/{number}"))
        if mapping(current.get("head")).get("sha") != sha:
            raise ValueError(f"PR {number} head changed during read; retry a fresh snapshot")
    snapshot["observed_at"] = datetime.now(timezone.utc).isoformat()
    return snapshot


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("queue", "status", "next", "check"))
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--fixture", type=Path, help="Read an exported snapshot; no credentials or network")
    source.add_argument("--repo", help="Read GitHub with existing gh authentication (owner/name)")
    parser.add_argument("--json", action="store_true", help="Machine-readable output")
    parser.add_argument("--now", help="Explicit ISO timestamp for reproducible fixture evaluation")
    parser.add_argument("--stale-hours", type=float, default=2, help="Observation/progress age limit (default: 2)")
    parser.add_argument("--issue", type=int, help="Filter output, after checking the complete snapshot")
    args = parser.parse_args(argv)
    try:
        snapshot = mapping(read_json(args.fixture.read_text()) if args.fixture else github_snapshot(args.repo))
        now = timestamp(args.now) if args.now else datetime.now(timezone.utc)
        rows = evaluate(snapshot, now, args.stale_hours)
        if args.issue is not None:
            rows = [r for r in rows if r.issue == f"{snapshot['repository']}#{args.issue}"]
            if not rows:
                raise ValueError("requested issue is absent from the snapshot")
        candidates = [r for r in rows if r.eligible]
        selected = candidates[0].key if candidates else None
        visible = rows if args.command in ("status", "check") else [r for r in rows if r.state not in INACTIVE]
        result = {
            "schema_version": 1,
            "dry_run": True,
            "command": args.command,
            "repository": snapshot["repository"],
            "observed_at": snapshot["observed_at"],
            "as_of": now.isoformat(),
            "stale_hours": args.stale_hours,
            "selected": selected if args.command == "next" else None,
            "scopes": [r.output() for r in visible],
        }
        if args.json:
            print(json.dumps(result, indent=2, sort_keys=True))
        else:
            print(f"{args.command} · dry-run · observed {snapshot['observed_at']} · as of {now.isoformat()}")
            for row in visible:
                reason = "; ".join(row.problems) or ("eligible" if row.eligible else "not ready")
                print(f"{row.key}  {row.state}  p={row.priority if row.priority is not None else '?'}  {reason}")
            if args.command == "next":
                print(f"next: {selected}" if selected else "next: none supported; inspect the reasons above")
        if args.command == "check":
            return 1 if any(r.problems for r in rows) else 0
        if args.command == "next" and not selected:
            return 1
        return 0
    except (OSError, ValueError, TypeError, subprocess.SubprocessError) as exc:
        if args.json:
            print(json.dumps({"schema_version": 1, "dry_run": True, "error": str(exc)}))
        else:
            print(f"issue queue: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
