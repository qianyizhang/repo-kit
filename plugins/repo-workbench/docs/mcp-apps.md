# MCP Apps in Repo Workbench

This file owns Workbench's host and transport contracts. Portable principles live
in repo-kit's `user/practices/mcp-apps.md`, installed under
`$CODEX_HOME/practices/mcp-apps.md`. [The README](../README.md) owns setup and commands;
[Canvas design](canvas-design.md) owns map, draft and source-edit behavior.
The source review is repo-kit's `docs/reviews/2026-10-22-mcp-apps.md`.

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

Contexts expire on server restart or after 12 newer opens; up to 8 traces per
context are retained in memory. Reopen an expired report.

## Canvas connection and recovery

Each open returns an opaque context ID with its own map draft. Panels in the same
repository/chat share durable discussion history; different repositories/chats
have separate mailboxes. A cancelled or expired request cannot retarget a panel.
The optional repository registry stores folder references, never maps or a global
target. Canonical repository identity stays visible.

Automatic connection uses the host-provided `_meta.threadId` (or matching `thread_id` alias),
then an exact-ID, read-only lookup of `cwd` in the newest `state_N.sqlite` under
`CODEX_HOME` (default `~/.codex`). This is a Codex-specific adapter, not a portable
MCP guarantee. Missing metadata, unknown database schemas, missing workspaces and
non-Git tasks fall back to the picker. It never scans conversation bodies or
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

The **ⓘ App info** control beside the header shows panel/server versions and build fingerprints, server start time and process/instance IDs, repository, caller chat, context, and local log path. It warns when builds differ. Its compact symbol controls copy details, refresh status, and download the connection log; tooltips and accessible names identify each action. The JSON report
includes bounded browser and server connection metadata, versions,
server identity, caller metadata key names and thread ID, panel/context IDs, event status and source-local timestamps. If the host is unavailable,
the download still includes the browser history after a five-second collection timeout.
Initialization failures can be retried without reloading the panel.

App info also exposes generated tool contracts, conversation fixtures and individual
frozen interactions. Inspect send opens only that send; server summaries and exact
event payloads have separate bounded APIs. Metadata is written under
`${XDG_STATE_HOME:-~/.local/state}/mcp-apps/<app-id>/<instance>/`, overridden by
`MCP_APP_LOG_ROOT`. Each app/server file rotates at 2 MiB with one prior file.
Startup keeps 8 inactive sessions for at most 7 days; live sessions are excluded.
Only an explicit **Save diagnostic capture** persists payloads for one interaction
(up to 2 MiB, 8 captures per session, same retention). Payloads are masked and
bounded in live memory; restart/closure can lose uncaptured payloads. Logging
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

The UI uses the official MCP Apps SDK through `ui/host-client.ts`; `ui/host.ts`
owns repository selection and restart recovery. Codex is the acceptance target.
Other hosts should adapt capabilities without copying domain behavior or assuming
Codex's SQLite layout. The SDK pin is in `package.json`; moving to MCP SDK 2.x
requires a coordinated server migration.

The packaged UI URI includes a fingerprint of source, static assets, build config
and lockfile. Server and UI expose the same build identity. Rebuilding a package
does not refresh a server retained by an existing chat.
