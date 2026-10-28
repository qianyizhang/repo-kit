# MCP Apps in Repo Workbench

This file owns Workbench's host and transport contracts. Portable principles live
in repo-kit's `user/practices/mcp-apps.md`, installed under
`$CODEX_HOME/practices/mcp-apps.md`. [The README](../README.md) owns setup and commands;
[Canvas design](canvas-design.md) owns map, draft and source-edit behavior.
The source review is repo-kit's `docs/reviews/README.md`.

## Reports and conversation context

The embedded views reuse the standalone renderers and indexed source reader.
Full bodies and images travel through `report_app`; the iframe does not fetch
localhost. **Send** delivers the user's text directly. **Attach filters or open evidence** (usage) or **Attach selected turn/action** (trace) adds a
small frozen summary of the current usage filters/open evidence, or a selected
trace turn/action. An unchecked attachment sends no evidence and creates no
selection. Additional totals, rows, events, event text and provenance use separate
scoped tools; the message never requires an initial read. Selections retain the
captured data and source identity through refresh. Up to 40 are retained; an
expired selection must be attached again. Unconfirmed delivery keeps the draft;
check the chat before resending.

The caller-aware registry retains at most 12 report contexts with a shared 512 MiB
accounted memory budget and a 24-hour idle limit. Each report bounds scan results
and retains at most 8 traces within 64 MiB. Eviction disposes the session and stops
its worker. Reopen an expired report. Frozen selections have a separate bounded
registry and preserve the caller who created them.

## Canvas connection and recovery

Each open returns an opaque context ID with its own map draft. Panels in the same
repository/chat share durable discussion history; different repositories/chats
have separate mailboxes. A cancelled or expired request cannot retarget a panel.
The optional repository registry stores folder references, never maps or a global
target. Canonical repository identity stays visible.

Automatic connection uses the host-provided `_meta.threadId` (or matching `thread_id` alias),
then an exact-ID, read-only lookup of `cwd` in the newest `state_N.sqlite` under
`CODEX_HOME` (default `~/.codex`). This is a Codex-specific adapter, not a portable
MCP guarantee. Hosted operations require caller identity; missing or conflicting
identity fails before context access. Unknown database schemas, missing workspaces
and non-Git tasks with a valid identity fall back to the picker. It never scans conversation bodies or
chooses the last-used repository. The desktop-bundled Codex 0.163.0-alpha.10.2
was probed through `mcpServer/tool/call`: it provided `threadId` and no workspace
path. Empty new chats can have an ID before their workspace is persisted. The picker explains this gap, retries automatically every five seconds while visible, and reports the outcome of manual retry. Choosing a repository explicitly works immediately and is not overridden when the chat is later persisted. The plugin cannot read the project selector when Codex does not supply it. Repeat the isolated, model-free probe with
`REPO_WORKBENCH_CODEX_BIN=/absolute/path/to/codex node tests/probe-metadata.ts`.

Each mounted panel has its own identity. After a server restart, a confirmed
missing-context response reconnects to that panel’s selected repository and
restores its in-memory draft/view. A transport timeout does not replay mutations.
Closing/recreating a panel has a different recovery boundary: browser storage may
be unavailable, so export unsaved drafts before replacing the whole panel.
Connection uses the typed `connect` operation. Panels never send automatic chat messages.
After upgrading from an earlier app protocol, reopen the panel after refreshing the server.

## Connection diagnostics

The **ⓘ App info** control opens one inspector with aligned app, host, repository,
caller, context, build and recording fields. Full JSON is under a disclosure.
Tools and Interactions use the same surface. A selected interaction has a bounded
payload area and can be pinned while inspected. Copy and metadata download remain
available. Panel/server build mismatch blocks domain actions until reopened.

App info also exposes generated tool contracts, conversation fixtures and individual
frozen interactions. Inspect send opens only that send; server summaries and exact
event payloads have separate bounded APIs. Metadata is written under
`${XDG_STATE_HOME:-~/.local/state}/mcp-apps/<app-id>/<instance>/`, overridden by
`MCP_APP_LOG_ROOT`. Each app/server file rotates at 2 MiB with one prior file.
Startup keeps 8 inactive sessions for at most 7 days; live sessions are excluded.
Only an explicit **Save diagnostic capture** persists payloads for one interaction
(up to 2 MiB, 8 captures per session, same retention). User actions and automatic reads/autosaves have separate count, byte and age
budgets, declared in the shared runtime. Expiration and partial captures are
explicit. Payloads are masked and bounded in live memory; restart/closure can lose uncaptured payloads. Logging
failure does not block domain work. These observations are not host internals or
proof of a model response. Standalone Canvas and the local report service share
the same diagnostic handlers; offline exports have memory inspection and an
explicit capture download, with no disk writer or conversation capability.

## Transport ownership

Canvas's `model/contracts.ts` owns inputs/results across HTTP and MCP;
`model/document.ts` owns saved-map validation. The app tool carries
`{contextId?, request: {action, args}}`. Removed binding-ticket routes have no
compatibility layer. Directory discovery accepts dynamic-route names, Unicode,
spaces and long paths without treating filenames as document IDs; existing saved
IDs remain unchanged.

The shared `HostSession` owns SDK initialization, frozen declarations and observed
capabilities, typed outcomes, cancellation and terminal disposal. Callbacks and
policy cannot be replaced after creation. Reconnect requires a new instance.
Canvas's `ui/host.ts` owns repository selection and explicit draft recovery; reports
keep view navigation separate from connection lifetime. Server `ReportSession`
owns scan adoption, revisions, trace reads and disposal for both HTTP and MCP.

The scoped registry owns authorization and retention together. All context,
request, selection and payload reads resolve the trusted caller before accessing
state. Opaque IDs and app-only visibility do not confer authority. Standalone
adapters declare a trusted local principal explicitly; they never infer it from
missing hosted metadata. Server diagnostics store app observations as claims.
Explicit interaction/call IDs cross forwarded tool calls; wire IDs stay local.

Polling is single-flight and pauses when hidden. Stopping a poller stops its timer
and aborts its signal. HTTP catalog reads use that signal; hosted discovery ignores
late results. Disposing a host session aborts its bridge reads. Stable Canvas views
send a revision heartbeat instead of the complete map.
Discussion writes use a SQLite transaction sidecar to coordinate atomic JSON
replacement. OS lock release recovers a killed writer; legacy orphan lock folders
are left untouched. Revisions are compared inside the transaction.

The canonical review parser validates nested recorded v3 and authored v2 documents,
including turns, events and lazy body references. Readers retain hash/provenance
checks. Inputs and outputs of report commands share one declaration map.

Codex is the acceptance target. Other hosts must supply trusted caller metadata.
The SDK pin is in `package.json`; a server SDK 2 migration remains separate.

The packaged UI URI includes a fingerprint of source, static assets, build config
and lockfile. Server and UI expose the same build identity. Rebuilding a package
does not refresh a server retained by an existing chat.

`dist/release.json` records the source revision and dirt (or explicitly unavailable
Git identity), protocol version, package-lock and shared-source identities, and
SHA-256/size for each emitted asset. Source, package, installed process and active
panel remain separate acceptance layers.
