# MCP Apps in Repo Workbench

- **Goal** · Run the same local operations in Codex and standalone with explicit caller, context, recovery and evidence boundaries.
- **Owners** · [Workbench README](../README.md) for setup · [Canvas design](canvas-design.md) for product behavior · repo-kit's MCP App runtime for shared host and diagnostics policy.

## Reports and conversation context

| Surface          | Outcome                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Embedded reports | Standalone renderer and read-only indexed reader. Load full bodies/images on demand via `report_app`. Back from trace preserves usage filters.                                                         |
| Send             | Direct user text. Optional **Attach filters or open evidence** (usage) or **Attach selected turn/action** (trace) adds a small frozen summary without provenance. Unchecked sends create no selection. |
| Evidence tools   | Separately scoped totals, rows, events, event text and provenance. Frozen selections retain captured rows/events, coverage, provenance and byte-pinned lazy refs across refresh.                       |
| Unconfirmed send | Preserve draft and attachment choice. Check the chat before deliberately resending.                                                                                                                    |
| Expired context  | Reopen a report or attach the selection again. Eviction disposes the session and stops its worker.                                                                                                     |

- **Bounds** · 12 caller-scoped report contexts, 512 MiB accounted shared memory, 24 idle hours. Up to 8 traces and 64 MiB per report. Separate registry of up to 40 frozen selections.
- **Usage refresh** · [Cached summaries and evidence limits](usage.md#refresh-and-evidence)

## Canvas connection and recovery

| Situation                               | Outcome                                                                                                                                                                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open                                    | Opaque context ID and independent map draft per open. Same-repo/same-chat panels share discussion history. Cancelled or expired requests preserve panel target.                                                                     |
| Host metadata                           | Trusted `_meta.threadId` or matching `thread_id` alias. Exact-ID read-only `cwd` lookup in latest `state_N.sqlite` under `CODEX_HOME` or `~/.codex`. Conflicting/missing identity fails before hosted access.                       |
| Workspace unavailable                   | Unknown schema, missing workspace or non-Git task with trusted identity falls back to the picker. [Selection and retries](canvas-design.md#repository-selection)                                                                    |
| Confirmed missing context after restart | Reconnect to the panel's selected repository and restore its in-memory draft/view. Transport timeouts never replay mutations.                                                                                                       |
| Teardown                                | A clean panel requests `canvas_release` under caller and panel identity. Draft/review/other panels can retain context. Pending discussion requests keep one caller-owned reply context. Unused chat opens can use the same release. |
| Abandonment or capacity                 | Contexts and bindings expire after 24 idle hours. Reject opens at 32 live contexts.                                                                                                                                                 |
| Panel replacement or upgrade            | Export unsaved drafts before replacing the panel. Browser storage can be unavailable. Refresh the server and reopen after a protocol upgrade.                                                                                       |

- **Connection** · Typed `connect` operation without automatic messages. Workspace lookup reads metadata only.
- **Probe** · Desktop Codex 0.163.0-alpha.10.2 supplied `threadId` and no workspace through `mcpServer/tool/call`. Repeat with `REPO_WORKBENCH_CODEX_BIN=/absolute/path/to/codex node tests/probe-metadata.ts` in an isolated model-free session.

## Connection diagnostics

| Control                | Outcome                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ⓘ App info**         | Aligned app, host, repo, caller, context, build and recording state. Full JSON on demand. Build mismatch blocks domain actions until reopened.                                                                                       |
| Tools and Interactions | Generated tool contracts, conversation fixtures, frozen interactions and pinned bounded payloads. Report results appear after decompression. Inspect send focuses one send. Separate bounded APIs expose summaries and exact events. |
| Copy and export        | Copy and metadata download. **Save diagnostic capture** explicitly persists retained masked payloads for one interaction.                                                                                                            |
| Standalone and offline | Local Canvas and the report service use the same handlers. Offline export has in-memory inspection and explicit capture download. Conversation and persistent log writing require the corresponding live host/runtime.               |

- **Retention** · Shared runtime policy owns disk location, rotation, session and capture limits. User actions and automatic reads/autosaves have separate budgets. Show expiry and partial captures. Restart can lose uncaptured payloads.
- **Evidence** · Recording failures leave domain work available. Observations cover instrumented boundaries. Host internals and model responses require separate evidence.

## Transport ownership

| Owner                                               | Contract                                                                                                                                                                                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canvas `model/contracts.ts` and `model/document.ts` | Shared HTTP/MCP inputs and results plus saved-map validation. App envelope is `{contextId?, request: {action, args}}`. Binding-ticket routes are retired. Directory discovery accepts dynamic names, Unicode, spaces and long paths while keeping saved IDs. |
| Shared `HostSession`                                | SDK initialization, immutable declarations/capabilities, typed outcomes, cancellation and disposal. Reconnect creates a new lifetime.                                                                                                                        |
| Canvas `ui/host.ts`                                 | Repo selection and explicit draft recovery. Stable views send a revision heartbeat.                                                                                                                                                                          |
| `ReportSession`                                     | Scan adoption, revisions, trace reads and disposal across HTTP/MCP. View navigation stays independent.                                                                                                                                                       |
| Scoped registry                                     | Authorize trusted caller before resolving contexts, requests, selections or payloads. Standalone adapters explicitly declare a trusted local principal.                                                                                                      |
| Poller and bridge                                   | Single-flight polling, paused while hidden. Stop clears timers and aborts signals. HTTP honors abort. Hosted discovery ignores late results. Disposal aborts bridge reads.                                                                                   |
| Review parser                                       | Validate nested recorded v3 and authored v2 documents and lazy refs. Readers preserve hash/provenance checks. One declaration map owns report commands.                                                                                                      |

- **Diagnostics identity** · Server stores app reports as claims. Interaction/call IDs cross participating boundaries. Wire IDs stay local.
- **Compatibility** · Codex is the acceptance target. Other hosts need trusted caller metadata. SDK pins live in `package.json`.
- **Delivery identity** · Resource URI and server/UI share the build fingerprint. `dist/release.json` records source revision/dirty state or unavailable Git identity, protocol, lock/shared-source identities and emitted file hashes/sizes. Verify source, package, installed process and active panel independently.
