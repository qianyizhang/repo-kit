# Read-only issue queue

[Issue #7](https://github.com/qianyizhang/repo-kit/issues/7) owns this CLI's scope.
Run `python3.12 scripts/issue_queue.py` from this checkout. GitHub issue bodies
are canonical; the process evaluates a snapshot in memory and writes only to
stdout/stderr. It does not assign workers, edit issues, dispatch, merge, schedule,
change authentication, or maintain a second queue. A recommendation is a dry run,
not authorization to act. The delivery guide is guidance, not installed coordinator
enforcement.

## Run a fixture

No packages, credentials, network or `gh` are needed:

```sh
python3.12 scripts/issue_queue.py queue --fixture tests/fixtures/issue_queue.json --now 2026-10-30T12:00:00Z
python3.12 scripts/issue_queue.py status --fixture tests/fixtures/issue_queue.json --now 2026-10-30T12:00:00Z --json
python3.12 scripts/issue_queue.py next --fixture tests/fixtures/issue_queue.json --now 2026-10-30T12:00:00Z
python3.12 scripts/issue_queue.py check --fixture tests/fixtures/issue_queue.json --now 2026-10-30T12:00:00Z
```

`queue` shows unfinished scopes and exclusion reasons. `status` includes paused,
retired and done scopes. `next` recommends the first eligible scope, or reports
why none is supported. `check` diagnoses incomplete, contradictory, stale or blocked
records. All commands accept `--json`, `--issue NUMBER` and `--stale-hours HOURS`
(default 2). Filtering happens after checking all dependencies and assignments.
`--now` is for reproducible snapshot analysis; otherwise evaluation uses current UTC.

Exit codes: **0** successful inspection/selection or a clean check; **1** no
supported next scope, or check diagnostics; **2** invalid input/access failure.
The example `check` intentionally exits 1 because the fixture contains holds,
stale receipts and an ordinary issue without metadata.

### Observed fixture flow

This is a synthetic scenario grounded in the CLI fixture, not live worker or CI
telemetry. Its source identity is repo-kit main
`9de4b37b30ad28d5728f0ba268f68d69916018b7`; fixture task names and observations are
invented. At the explicit time above, the tested transformation is:

```text
issue #7 body                          in-memory checks                output
  preflight: done, old proof  ────────► identity/assumptions match ────► dependency satisfied
  publish: approval-blocked ─────────► exact publish target pending ──► held
  build: ready, priority 10 ─────────► released/unassigned + proof ───► next: #7/build
  stalled: running, 4h old ──────────► owner/progress older than 2h ───► investigate; no reassignment
  extra: paused / old: retired ──────► explicit state ────────────────► excluded
issue #101: ordinary prose ──────────► no structured metadata ────────► unknown

Stored afterward: nothing. Issue bodies and fixture bytes stay unchanged.
```

Old evidence can remain valid; an old owner observation cannot establish current
availability. An exact publication hold does not block a separate build action.

## Issue-body contract, version 1

Use exactly one column-zero fenced `repo-kit-queue` JSON block in the canonical
issue body. Examples nested in other fences are ignored; incomplete metadata
fences are invalid.
V1 does not discover receipts in comments or follow arbitrary links. A handoff
may link to this block. Ordinary existing issues remain `unknown` until their
owners explicitly supply metadata; do not mass-edit them to satisfy this tool.
The snapshot's issue number/repository must match the block's `issue` identity.
Duplicate blocks, JSON keys, issue observations and issue/scope records are
conflicts, not last-write-wins updates.

A complete synthetic scope (the fixture supplies concrete source/artifact values):

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

Every shown field is required. Locations identify preserved artifacts/receipts;
the CLI checks recorded identities and conditions, not remote artifact bytes or
the truth of a receipt. Record immutable revisions/digests, meaningful progress
and exact acceptance instead of repeatedly refreshing timestamps. Issue update
time, prose, labels, assignees and absence of a PR never imply readiness.

- **States:** `ready`, `running`, `local-unpushed`, `review`, `approval-blocked`,
  `paused`, `retired`, `done` remain distinct. Only `ready` on an open issue is a
  candidate. A closed issue with unfinished scope is a conflict.
- **Owner:** `unassigned` requires explicit null `id` and `task_id`; `active` and
  `released` require both exact identities. `unknown` or absent data cannot
  establish availability. `running` requires an active owner; ready work with
  an active owner is excluded. These are timestamped observations, not live
  worker telemetry. Stale work needs investigation, not automatic reassignment.
- **Readiness:** explicit `ready`, acceptance, source/artifact identity and at
  least one passing evidence entry are required. Each entry must match the
  current source, artifact and assumptions exactly. Evidence age alone does not
  force a rebuild. `blocked` and missing readiness prevent selection.
- **Progress:** nonterminal scope progress and owner observations expire after
  the configured interval. Done evidence can still satisfy dependencies when its
  artifact and assumptions match. Future-dated receipts are invalid.
- **Dependencies:** use `{"issue":"owner/repo#N","scope":"id","artifact_identity":"exact-id"}`.
  The target must be present, unambiguous, valid and `done` with that artifact.
  Unknown targets, cycles, repeated/conflicting edges and paused/retired targets
  do not satisfy a dependency. V1 reads one repository; external dependencies
  remain unknown unless supplied in a future supported source format.
- **Assignments:** task identifiers are unique among unfinished, unpaused scopes.
  Repeated active owner IDs or worker task IDs are conflicts. Stale observations
  never release an assignment implicitly.
- **Holds:** each blocker requires `action`, `target`, `reason`, `status`
  (`pending`, `denied`, `uncertain`), `required` (the missing approval/input),
  `completed` (work already retained), `artifact_identity`, and `observed_at`.
  A hold excludes only a matching `(action, target)` within its scope.
  `approval-blocked` needs that matching hold. A denial stays denied; this CLI
  cannot grant approval or propose an alternate route.
- **Order:** eligible scopes sort by integer priority (lower first), then exact
  issue identity and scope identifier, lexicographically. No inferred priority.

## Optional GitHub reads and CI

With existing authorized `gh` access:

```sh
python3.12 scripts/issue_queue.py next --repo qianyizhang/repo-kit --json
```

The adapter uses only `gh api --method GET`: paginated repository issues
(`state=all`, PR entries excluded), explicitly referenced PRs and paginated
workflow runs for their current head SHA. It stops on an access failure; it never
runs login, modifies credentials or retries through another access path. Fixture
mode never invokes it. Network/auth access remains an environment prerequisite.

Declare `"ci": null` when CI is not required for this action; missing `ci` is
unknown. Otherwise use `"ci": {"pr": 6, "workflows": [12345]}` with actual numeric
workflow IDs. The artifact identity must be `git:HEAD_OWNER/HEAD_REPO@FULL_HEAD_SHA`.
For each required workflow, only runs matching the current head, head repository
and branch are considered. A `pull_request` run must also reference that PR;
`push` runs on that head branch are supported. Other events, including
`pull_request_target`, are not evidence for this check.

The latest relevant workflow run number and rerun attempt must be completed and
successful. An earlier pass cannot hide a later failure or running attempt.
CI source observations must be fresh, though an old successful run for the same
head can remain valid. The adapter rereads PR heads to detect a racing force-push
and rejects incomplete run pagination (GitHub caps filtered run searches). Reads
are observations, not an atomic GitHub snapshot or a lock on subsequent changes.
See the GitHub [issues](https://docs.github.com/en/rest/issues/issues#list-repository-issues)
and [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-repository)
read contracts.

Snapshots use `schema_version: 1`, `repository`, `observed_at`, raw GitHub `issues`,
and optional raw `pull_requests`/`workflow_runs` arrays. Preserve original bodies,
head/run IDs and timestamps when exporting. JSON output retains the parsed receipt,
issue source identity and selected CI run identity. There is no Codex cloud-state
adapter or dispatch API: a cloud-list probe returning 401 establishes neither.

Tests: `python3.12 -m unittest discover -s tests -p test_issue_queue.py -v`.
