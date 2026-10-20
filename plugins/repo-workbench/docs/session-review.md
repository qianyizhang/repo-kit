# Creation trace behavior debugger

A local, read-only viewer for tracking how an artifact changed in response to feedback. Creation stories, captures, source snapshots, and raw actions connect in one offline HTML bundle. Commands are inert text; the viewer does not run models, upload traces, or alter game state.

## Build and open

```sh
repo-workbench trace --repo /absolute/repository --input exports --case case.json --out reviews/new
```

The command returns the bundle path as JSON. Open `index.html` directly. An explicit output must be new, within the declared repository, and disjoint from input. Default output is a fresh `.cache/repo-workbench/reviews/` directory. Keep lasting exports in an explicit destination.

Source readers and collection live in `packages/trace/`; the [session-review module](../packages/session-review/README.md) owns presentation. Inputs are `<thread-id>.json` exports of `read_thread` with `includeOutputs: true`, `schemaVersion: 1`, and `turns`. Synthetic examples and all generic browser journeys live with this plugin. Project-specific case definitions and private-evidence tests stay in their owning repository.

### Session action navigation

- **Action grouping**: A tool invocation, its native executions, and its result appear as one action. Shell commands preserve readable I/O pairs; folded wrappers preserve outer scripts and status output. Matching call identity or literal command matches in the same session/turn are required for linking.
- **Review signals**: Filters highlight compaction, user questions, mid-turn inputs, errors/rejections, missing calls/results, and upstream truncation. Commentary and final responses have distinct badges and minimap colors.
- **Metadata**: Shows recorded action times, elapsed durations, and token usage (input, cached input, output).
- **Tool execution**: MCP calls match tool identity and canonical arguments. Batches show execution counts, Shell/MCP breakdown, and parallel counts for proven `Promise.all` batches. Native web operations link to matching completed wrappers. Native clock waits show duration.
- **User questions & compaction**: Combines question invocations with explicit prompt messages and recorded answer fields. Compaction markers appear as timeline actions with elapsed time and window counts.

## Model and evidence boundaries

```text
Source trace → normalized events → episode evidence
                                   ↓
                           artifact revisions
                                   ↓
                              assessments → authored story
```

| Layer             | Authority and contents                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Source            | Collected export identified by SHA-256. May omit or truncate history.                                   |
| Normalized trace  | `ReadThreadExportAdapter` preserving observable messages, commands, outputs, patches, images, and refs. |
| Episode           | Curated request/work/inspection/assessment cycle (`stages`).                                            |
| Artifact revision | Stable identity, retained capture angles, hashes, subject sources, and production/inspection refs.      |
| Assessment        | Authored criterion, subject, status, assessor, basis, evidence, and limits.                             |
| Story             | Authored question/change/finding/lesson prose. Interpretation, not private reasoning.                   |

## Investigate a revision

- **Conversation**: Scans request/response pairs across 20 turns per page. Search indexes text; structured inputs show field previews; patches highlight diffs. Thread, turn, search, and page persist in URL fragments.
- **Process map**: Curated episode sequence filtered by subject, requests, changes, or lessons. Exports authored summaries and evidence links to accompanying learning notes.
- **Creation story**: Requests, findings, artifact comparisons, and worker/parent ownership breakdown.
- **Evidence drawer**: Inspect full record bodies, switch between Markdown/code/raw text, open recorded actions, and inspect source diffs.
- **Compare revisions**: Before/after revision comparison per subject across the authored assessment criterion matrix.
- **Recorded actions**: Search text/output, filter by session, turn, type, episode, or role.
- **Source & provenance**: Inspect source snapshots, diffs by stable key, actor relationships, schema metadata, and SHA-256 manifests.

## Add a case or episode

Curate around consequential decisions: state request, attempted change, finding, and reusable lessons.

Create a case JSON with `title`, `threads`, and `stages`. Set `assetRoot` for collected source/capture folders, `captureSubjects` for subject IDs, and `captureViews` for filename patterns such as `{"hero": ["{subject}-hero.png"]}`. Declare thread IDs, display roles, and optional parent IDs. Use a stable episode `id` and an exact `anchorRef`. Episodes require an `evidence` array referencing observable normalized events:

```json
{
  "thread": "worker-thread-id",
  "turn": "source-turn-id",
  "event": "recorded-event-id",
  "role": "inspection"
}
```

Permitted roles: `request`, `feedback`, `plan`, `action`, `edit`, `artifact`, `inspection`, `verification`, `assessment`, `handoff`, `other`.

## Attach artifacts and source history

- **Captures**: `capture`, `captures`, `source`, `sources` locate directories under `test-results/`. Standard names: `<subject>-hero.png`, `-frame.png`, `-desktop.png`, `-side.png`, `-back.png`, `-large.png`, `-roundtrip-live.png`, `-roundtrip-exported.png`.
- **Source keys**: Map full paths in `sourceKeys` to track revisions across stages:
  ```json
  {
    "sourceKeys": {
      "test-results/round1/source/nightjar.ts": "nightjar-model",
      "test-results/round2/source/nightjar.ts": "nightjar-model"
    },
    "sourceSubjects": { "nightjar-model": "nightjar" }
  }
  ```
- **Document references**: Use repository-relative paths or `{ "path": "docs/review.md", "revision": "<commit-hash>" }` to pin exact Git blobs.

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
  "note": "Folded wing reads as a slab; exact source pairing unknown."
}
```

Statuses: `issue`, `improved`, `passed`, `accepted`, `rejected`, `not_checked`, `unresolved`, `unknown`, `unrecorded`. Basis: `reviewer`, `user`, `verification`, `maker`, `record_limit`.

## Boundaries and limits

- Counts reconcile normalized, unsupported, and excluded items. Unsupported types keep identity metadata without raw payloads.
- `sourceTruncated` flags upstream truncation; `displayTruncated` indicates preview shortening.
- Cross-thread concurrency and private reasoning are excluded.
- Historical technical checks verify navigation and data integrity, not current visual quality.
- `normalize.ts` defines the explicit adapter boundary; no external services or network calls are used.
