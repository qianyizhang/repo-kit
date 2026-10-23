# Shared observability scaffold

## What the user can inspect

Keep ⓘ available in every operational state, with the accessible name “App info”.
Use progressive disclosure within it:

- **Info:** app/version/build, resource URI, standalone/hosted/fixture mode,
  connection, capabilities, server instance, log location and recording health.
- **Tools:** generated catalog of every registered tool and its operation contract.
- **Conversation flow:** plain-text and selected-context fixtures, exact request,
  reads triggered, visible result, and ordered actor-to-actor sequence. Separate
  app tool calls, model tool calls, context updates and conversation messages.
- **Interactions:** ordered action summaries. Selecting an action exposes each
  frozen request/result, its source, target, event/interaction/session IDs, times,
  status and completeness. Offer selectable/copyable JSON and export. Inspecting
  an event must not rerun the action or recursively record its own payload.

Each send has its own inspect action, including failed/uncertain sends. Persist
metadata by default; keep frozen payloads in bounded live memory. Closing or
restarting can lose those payloads. A deliberate **Save diagnostic capture**
persists only the chosen interaction's retained observations. Treat diagnostic
events as untrusted data; app-origin observations do not become server-verified
facts merely because the server stored them.

## Log owner and location

The starter server is the sole file writer. Browser observations reach it through
a dedicated bounded app-only append tool, or the equivalent local HTTP endpoint.
If that fails, the app keeps a bounded memory log and reports the persistence gap;
logging failure does not block the user's message.

Default local path:

```text
${XDG_STATE_HOME:-~/.local/state}/mcp-apps/<app-id>/<server-instance>/
  session.json
  app.jsonl
  server.jsonl
  capture-<id>.json  # only after Save diagnostic capture
```

`MCP_APP_LOG_ROOT` overrides the directory above `<app-id>` for tests or deployment.
Use absolute resolved paths. Each server instance owns its files, avoiding shared
rotation races. Session directories are private, files owner-readable/writable.
Stdout belongs exclusively to MCP protocol traffic; diagnostics go to the log or
stderr. Never use a repository checkout or plugin cache as the default log owner.

The starter caps each metadata source file at 2 MiB and rotates one previous file.
Explicit captures are limited to 8 per session and 2 MiB each. Exceeding a capture
limit reports failure without silently truncating or expanding its scope. On server
startup it prunes only recognized inactive session directories: keep at most 8
inactive sessions and at most 7 days. Live processes are excluded; explain that
active instances may exceed the inactive retention budget. This cleanup trigger,
scope and policy appear in App info. Do not follow symlinks during cleanup. Adapt
the policy explicitly when a product needs different retention or a remote server.

## Payload limits and privacy

Record application-boundary requests/results as observed, not reconstructed from
current UI state. The starter masks credential-named fields before live inspection
or explicit capture and retains up to 64 KiB per payload. It marks redacted and truncated
payloads; a prefix is never labeled “full”. Free text may still contain sensitive
content: use synthetic fixtures for tests, disclose retention, and adapt domain
redaction before handling private datasets. Do not log auth headers or transport
credentials. User-visible exports follow the same policy.

Automatic disk recording is metadata-only, even when a payload is visible live.
Do not enable automatic payload persistence through an implicit environment default.
Show omissions and their reason in the inspector. An on-demand payload read should
fetch the frozen event, never reread the live document and call it historical input.
An explicit capture saves the currently retained masked observations, not lost or
truncated original bytes. State capture scope, path, retention and completion.
Do not reread source files or rerun an action to fill historical gaps. No automatic
“fetch everything” action or capture of unrelated interactions.

## Evidence and correlation

Use unique event IDs and an interaction ID across boundaries where the protocol
allows propagation. Preserve source-local receipt order and timestamps. Host
request IDs may change at each boundary. Do not invent correlation to an assistant
turn or infer causality from wall-clock order alone.

The starter records **SDK/application-boundary observations**, not JSON-RPC wire
frames or the host's complete model prompt. Label that coverage in Info and the
sequence view. If a product needs wire capture, instrument the actual transport,
retain that source separately, and test ID/error/close handling. Unknown host
steps remain unknown; never synthesize token streams or fill live traces with
fixture events.

The tool catalog, UI sequence, export and log views are projections of their
canonical definitions/events. They must not become competing hand-maintained
specifications.
