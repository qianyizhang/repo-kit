# Creation trace behavior debugger

- **Goal** · Explain how a recorded artifact changed after feedback. Link requests, actions, revisions, assessments and retained evidence.
- **Outcome** · Read-only offline HTML. Commands appear as inert text. Traces stay local.

## Build and open

```sh
repo-workbench trace --repo /absolute/repository --input exports --case case.json --out reviews/new
```

- **Input** · `<thread-id>.json` exports of `read_thread` with `includeOutputs: true`, `schemaVersion: 1` and `turns`.
- **Output** · JSON with the bundle path. Open `index.html`. Explicit output must be new, inside the declared repo and disjoint from input. Default is a fresh directory under `{repo}/.cache/repo-workbench/reviews/`.
- **Owners** · `packages/trace/` reads and normalizes. `packages/session-review/` presents. Target repos own case definitions and private-evidence checks.

### Session action navigation

| Surface                  | Outcome                                                                                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action grouping          | Invocation, matched native executions and result appear together. Same-session/turn identities or literal command matches support linking. Folded wrappers preserve outer scripts and statuses.                                                             |
| Execution metadata       | Recorded action times, durations and input/cache/output tokens. MCP links rely on tool identity and canonical arguments. Batch counts show Shell/MCP and proven `Promise.all` parallelism. Completed web wrappers and native clock waits preserve evidence. |
| Review signals           | Find compaction, user questions, mid-turn input, errors/rejections, missing calls/results and upstream truncation. Commentary and final responses have distinct badges and minimap colors.                                                                  |
| Questions and compaction | Combine explicit prompts and recorded answers. Timeline shows recorded compaction duration and window counts.                                                                                                                                               |

## Model and evidence boundaries

| Layer             | Authority                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| Source            | SHA-256-pinned export with explicit truncation or omissions                                        |
| Normalized trace  | `ReadThreadExportAdapter` retains observable messages, commands, outputs, patches, images and refs |
| Episode           | Authored request/work/inspection/assessment cycle (`stages`)                                       |
| Artifact revision | Stable subject identity, capture angles, hashes, source and production/inspection refs             |
| Assessment        | Criterion, status, assessor, basis, evidence and limits                                            |
| Story             | Authored interpretation of questions, changes, findings and lessons                                |

- **Coverage** · Counts reconcile normalized, unsupported and excluded items. Unsupported events retain identity metadata. `sourceTruncated` flags upstream gaps. `displayTruncated` flags shortened previews.
- **Limits** · Cross-thread concurrency, private reasoning and present visual quality lie outside recorded technical checks.

## Investigate a revision

| View                           | Find                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Conversation                   | Request/response pairs, search, field previews and patch diffs across 20 turns per page. URL keeps thread, turn, search and page. |
| Process map and creation story | Filterable episode sequence, authored summaries, evidence links, findings and worker/parent contributions                         |
| Compare revisions              | Before/after by subject across authored assessment criteria                                                                       |
| Recorded actions               | Search text/output and filter by session, turn, type, episode or role                                                             |
| Evidence drawer and provenance | Full Markdown/code/raw bodies, recorded actions, stable-key source diffs, actor relationships, schema and hash manifests          |

## Add a case or episode

- **Goal** · A consequential request, attempted change, finding and reusable lesson with observable evidence.
- **Case** · `title`, `threads`, `stages`. Each thread has an ID, display role and optional parent ID.
- **Episode** · Stable `id`, exact `anchorRef` and an `evidence` array of `{"thread":"THREAD_ID","turn":"TURN_ID","event":"EVENT_ID","role":"inspection"}` references.
- **Evidence roles** · `request`, `feedback`, `plan`, `action`, `edit`, `artifact`, `inspection`, `verification`, `assessment`, `handoff`, `other`.

## Attach artifacts and source history

| Material         | Accepted reference                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Captures         | `assetRoot`, `captureSubjects`, `captureViews` (for example `{"hero":["{subject}-hero.png"]}`). `capture`, `captures`, `source`, `sources` locate directories under `test-results/`. Standard subject suffixes: `hero`, `frame`, `desktop`, `side`, `back`, `large`, `roundtrip-live`, `roundtrip-exported`. |
| Source revisions | `sourceKeys` maps full paths to a stable key across stages. `sourceSubjects` maps that key to a subject.                                                                                                                                                                                                     |
| Documents        | Repo-relative path or `{"path":"docs/review.md","revision":"COMMIT_HASH"}` for the exact Git blob                                                                                                                                                                                                            |

## Add assessments

```json
{
  "criterion": "wing construction",
  "subject": "nightjar",
  "assessment": "issue",
  "actor": "Parent reviewer",
  "basis": "reviewer",
  "evidence": [
    { "thread": "parent-id", "turn": "turn-id", "event": "review-id", "role": "assessment" }
  ],
  "note": "Folded wing reads as a slab. Exact source pairing unknown."
}
```

- **Statuses** · `issue`, `improved`, `passed`, `accepted`, `rejected`, `not_checked`, `unresolved`, `unknown`, `unrecorded`.
- **Basis** · `reviewer`, `user`, `verification`, `maker`, `record_limit`.
