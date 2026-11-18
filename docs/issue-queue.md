# Read-only issue queue

- **Goal** · Inspect canonical GitHub issue receipts for eligible work and explain what blocks it. [Issue #7](https://github.com/qianyizhang/repo-kit/issues/7)
- **Effect** · Evaluate a snapshot in memory and print results. GitHub access uses read-only requests. Recommendations grant no execution authority.

| Command | Outcome |
| --- | --- |
| `queue` | Unfinished scopes and exclusion reasons |
| `status` | All recorded states, including paused, retired and done |
| `next` | First eligible scope or the reason none qualifies |
| `check` | Incomplete, conflicting, stale and blocked records |

- **Options** · `--json` for structured output, `--issue NUMBER` to filter after evaluating the full snapshot, `--stale-hours HOURS` for observation freshness (default 2), `--now` for reproducible evaluation (default current UTC).
- **Exit codes** · 0 for successful inspection or a clean check. 1 for no eligible scope or check diagnostics. 2 for invalid input or access failure.

## Run a fixture

```sh
python3.12 scripts/issue_queue.py next --fixture tests/fixtures/issue_queue.json --now 2026-10-30T12:00:00Z
```

- **Expected** · `#7/build` qualifies. The matching preflight proof remains valid. A hold excludes publication. A stale running assignment needs investigation. An ordinary issue is unknown. Fixture `check` exits 1.
- **Inputs** · [Synthetic snapshot](../tests/fixtures/issue_queue.json) at repo-kit source `9de4b37b30ad28d5728f0ba268f68d69916018b7`. Fixture mode needs only Python 3.12.

## Issue-body contract, version 1

- **Identity** · Exactly one complete, column-zero `repo-kit-queue` JSON fence in the issue body. Nested examples and comments are outside the contract. The receipt's issue identity matches the snapshot. Missing metadata is unknown. Duplicate blocks, keys, issue observations or scopes are conflicts.
- **Fields** · Every field in the example is required. Use immutable identities and locations for retained evidence. The CLI validates recorded claims and conditions. Labels, assignees, issue update time and PR absence do not establish readiness.

````markdown
```repo-kit-queue
{
  "schema_version": 1,
  "issue": "qianyizhang/repo-kit#7",
  "scopes": [{
    "scope": "build",
    "task": "issue-7-build",
    "action": "build",
    "target": "qianyizhang/repo-kit:queue-cli",
    "state": "ready",
    "priority": 10,
    "owner": {"state": "unassigned", "id": null, "task_id": null, "observed_at": "2026-10-30T12:00:00Z"},
    "last_progress": {"at": "2026-10-30T12:00:00Z", "summary": "Preflight completed", "artifact_identity": "artifact-A"},
    "source": {"identity": "source-A", "location": "https://example.invalid/source"},
    "artifact": {"identity": "artifact-A", "location": "https://example.invalid/retained-artifact"},
    "assumptions": "scope-v1; Python 3.12; read-only",
    "acceptance": "queue/status/next/check preserve unknown and explain selection",
    "readiness": "ready",
    "dependencies": [],
    "evidence": [{
      "check": "source preflight", "result": "pass",
      "source_identity": "source-A", "artifact_identity": "artifact-A",
      "assumptions": "scope-v1; Python 3.12; read-only",
      "location": "https://example.invalid/receipt", "observed_at": "2026-10-29T12:00:00Z"
    }],
    "blockers": [],
    "ci": null
  }]
}
```
````

| Condition | Decision |
| --- | --- |
| State | Only explicit `ready` on an open issue is eligible. `running`, `local-unpushed`, `review`, `approval-blocked`, `paused`, `retired` and `done` have distinct outcomes. Closed issues with unfinished scopes conflict. |
| Owner | `unassigned` requires null owner and task IDs. `active` and `released` require both IDs. `running` requires an active owner. Active, missing or unknown ownership excludes ready work. |
| Readiness | Requires explicit readiness, acceptance, source/artifact identity and at least one passing check. Evidence must match the source, artifact and assumptions exactly. |
| Freshness | Nonterminal progress and owner observations expire. Staleness never releases assignments. Evidence age alone leaves matching proof valid. Future-dated receipts are invalid. |
| Dependency | `{"issue":"owner/repo#N","scope":"id","artifact_identity":"exact-id"}` resolves to a valid, unambiguous `done` scope with that artifact. Missing, external, duplicate or cyclic edges and paused/retired targets fail. |
| Assignment | Unique task IDs across unfinished, unpaused scopes. Duplicate active owner/task IDs and mixed active/released observations of one worker task conflict. Timestamps alone do not resolve conflicts. |
| Hold | Requires action, target, reason, status (`pending`, `denied`, `uncertain`), required input, retained work, artifact identity and observation time. `approval-blocked` requires a matching hold. The hold excludes the same (action, target) across the snapshot. Different actions or targets remain independent. |
| Order | Lowest integer priority first, then exact issue identity and scope in lexical order. |

## Optional GitHub reads and CI

```sh
python3.12 scripts/issue_queue.py next --repo qianyizhang/repo-kit --json
```

- **Read boundary** · Existing authorized `gh` credentials. Paginated `GET` requests for repository issues, explicitly referenced PRs and their current-head workflow runs. Access failures stop evaluation. [Issues API](https://docs.github.com/en/rest/issues/issues#list-repository-issues) · [Workflow runs API](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-repository)
- **CI requirement** · `"ci": null` declares no CI requirement. Missing `ci` is unknown. Otherwise provide `"ci": {"pr": 6, "workflows": [12345]}` and artifact identity `git:HEAD_OWNER/HEAD_REPO@FULL_HEAD_SHA`.
- **Eligible runs** · Same head SHA, repository and branch. Eligible events are `push` and `pull_request` with the matching PR.
- **Acceptance** · Latest relevant attempt per required workflow completed successfully. Initial attempts order by `created_at`, then run number. Reruns require attempt-specific `run_started_at`. Conflicting run identities, ambiguous chronology, stale observations, changed PR heads or incomplete pagination leave CI unverified.
- **Snapshot** · `schema_version: 1`, `repository`, `observed_at`, raw `issues` and optional raw `pull_requests` and `workflow_runs`. Retain original bodies, IDs and timestamps. Future snapshot observations are invalid. Reads are point-in-time observations across multiple requests.
- **JSON evidence** · Parsed receipt, issue source identity and selected CI run identity.
- **Tests** · `python3.12 -m unittest discover -s tests -p test_issue_queue.py -v`.
