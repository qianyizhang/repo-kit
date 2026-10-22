# Example MCP App

A four-role sequence workspace explains **Main conversation / App panel / Host /
MCP server**. Choose one scenario, inspect captured events on its timeline, and
compare operation outcomes in place. The composite Investigate → ask journey
advances resource, tool, context and message steps through separate deliberate actions.

## Two explicit modes

- **Learn with fixtures:** deterministic teaching examples. Playing a fixture
  sends no demo request, context update or chat message. Available standalone and
  inside Codex. Rejection and timeout examples are clearly labelled.
- **Run live:** the installed Codex panel uses the official SDK bridge and real
  stdio MCP server. Missing capabilities disable controls. Errors stay visible;
  fixtures are never substituted. Message acknowledgment is separate from arrival
  in the conversation and a model response.

The standalone surface is deliberately a teaching app, not an imitation chat
host. It shares the journey views and evidence model with the native panel. This
is the product-specific exception to real standalone domain operations in the
shared MCP Apps guide (`$CODEX_HOME/practices/mcp-apps.md`): the domain being taught
is the host bridge itself. Simulated conversation exists only in `tests/`.

## Build and preview

Use Node 24.21 or newer:

```sh
npm ci --ignore-scripts
npm run build
npm run preview
```

Open **http://127.0.0.1:4390**. This serves the self-contained app with Live
disabled. It starts no MCP server and has no fake conversation inbox or RPC proxy.

## Install as a Codex plugin

`plugin.json` supplies the plugin identity. `mcp.json` starts the bundled stdio
server from `${PLUGIN_ROOT}`. Only `example_open` advertises a UI entrypoint and
attaches the HTML resource in both tool metadata and its result. Data calls do
not remount the panel. No browser server is required for the native plugin.

For this Mac, the package is installed like Repo Canvas:

1. Build and verify, then `npm pack --pack-destination /tmp`.
2. Install that archive with `npm install --ignore-scripts --omit=dev --no-audit
--no-fund --prefix "$HOME/.local/share/example-mcp-app" /tmp/<archive>.tgz`.
3. Add `example-mcp-app` to the existing personal marketplace, preserving its
   other entries. Its local source path relative to the marketplace root is
   `./.local/share/example-mcp-app/node_modules/@repo-kit/example-mcp-app`.
4. Use the desktop-bundled CLI: `codex plugin add example-mcp-app@personal --json`.
5. Remove the old project-only `[mcp_servers.example_mcp_app]` registration to
   prevent two copies. Reconnect Codex, open **Example MCP App**, and expand it
   into the side panel.

A source build, installed package, Codex cache and active panel can differ.
Compare fingerprints in **Connection details**. A detected build mismatch blocks
live actions before parsing version-specific trace data; fixtures remain available. Reinstall and reconnect after
changes; rebuilding the checkout does not update an already running server.

## Read the evidence

A user click creates an **interaction ID**. Tool arguments and resource URIs
carry it across the host. The two SDK transports capture real envelopes. A raw
JSON-RPC **wire ID** matches one request with its response on one connection;
the host can rewrite it. Wire IDs stay in each event's payload preview and pinned inspector. Timing
is the interval between request and response at that capture point; server timing
is not an end-to-end round trip.

The actor lanes explain the route and what the recorded boundaries establish. Forwarding is
**inferred** when both legs share an interaction ID. Internal host processing is
not instrumented. For message/context journeys, the app captures the actual
bridge acknowledgment; it cannot observe model execution.

Each scenario retains previous runs and independent drafts. Observer calls and
size notifications are available through the event log's **Housekeeping** filter. Refresh reads one server snapshot; it cannot include its own response. While an
operation is pending, non-overlapping bounded snapshot reads collect server events.
The local observer updates immediately; server events append to the log when received. Complete, uniquely correlated RPC
paths use explicitly inferred sequence order in the graph; ambiguous paths keep
receipt order. No
synthetic payload chunks are generated. Actual partial tool-input notifications
update a stable stream row and remain separate raw log records. Responses distinguish protocol errors, tool
`isError`, successful replies and uncertain timeouts. A timeout never auto-resends.
A teardown notification alone does not establish that a panel closed.

## State, boundaries and limits

- Each transport retains 250 events; the merged view retains 500 observations and
  the panel retains 30 runs. Overlapping snapshots are deduplicated by source
  instance and sequence. Receipt order does not establish cross-clock causality. The server trace
  belongs to one process and may include multiple panels. Per-run IDs isolate
  feature results; the startup page shows process-wide discovery evidence.
- `example_trace` returns the server snapshot and a compact panel index. An
  explicit `panelId` also returns that panel's self-reported UI evidence.
- The app uses `example_report` to publish bounded live evidence after actions.
  The server retains at most 12 panels for one hour, filters fixture events and
  rejects mismatched builds. Reports are diagnostic claims, not trusted proof of
  host execution. App-only discovery metadata is not an authorization boundary.
- Payloads are frozen and capped at 12,000 characters. HTML bodies are summarized.
  Common credential-named fields are redacted; **free text is recorded**. Use demo
  data. All payloads are rendered as text. No repository files are read.
- Nothing is persisted. Server restart or iframe destruction clears its state.
  Export evidence before closing. Export uses the host download capability when
  available; browser downloads depend on the host sandbox.
- The HTML bundles SDK, application and CSS. The resource URI includes a build
  fingerprint, MIME type is `text/html;profile=mcp-app`, and CSP permits no
  external connections or resources. Browser storage and relative assets are
  not required.

## Source map

| File                                           | Responsibility                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `src/contracts.ts`                             | Shared schemas and bounded panel report storage                         |
| `src/trace.ts`                                 | SDK transport capture and explicit request/run correlation              |
| `src/observability.ts`, `src/sequence.ts`      | Bounded deduplicated observations, actor routes and stream projections  |
| `src/view.ts`                                  | Sequence, event log, payload previews and pinned inspector              |
| `src/journeys.ts`                              | Journey definitions, deterministic fixtures and evidence interpretation |
| `src/app.ts`, `src/app.html`, `src/styles.css` | Shared UI and native SDK integration                                    |
| `src/server.ts`                                | Tool/resource registration and stdio server                             |
| `src/preview.ts`                               | Fixture-only standalone server                                          |
| `tests/host.ts`, `tests/host-server.ts`        | Test-only SDK host and real server proxy                                |

## Verification

```sh
npm run check
EXAMPLE_TEST_PORT=4397 npm run test:browser
EXAMPLE_CODEX_BIN=/absolute/path/to/desktop-bundled/codex npm run probe:codex
```

`check` runs formatting, typed lint, TypeScript, bundling, trace/fixture tests and
an isolated delivered-server test with no source dependencies. Browser tests
use disposable Chrome profiles, an opaque iframe and restrictive CSP. They
exercise fixture isolation, correlation, errors, capability gating, timeout,
keyboard, narrow layout, theme, export and teardown. On this Mac, run browser
tests outside the restricted sandbox per the browser testing guide.

The [outcome/wiring matrix](tests/OUTCOMES.md) lists each exercised path and its
acceptance assertions.

The native probe uses the actual desktop-bundled Codex app-server and installed
plugin configuration, opens an ephemeral model-free thread, verifies plugin
provenance, reads the HTML resource, calls echo and checks same-instance traces.
It rejects an installed build that differs from the tested `dist/build.json`.
It does not prove an active desktop panel or real conversation delivery.

Final native acceptance: open the installed panel, run a uniquely labelled echo
and resource read, inspect its panel report through `example_trace`, send a
uniquely labelled chat message, and confirm its arrival in the owning chat.
Fixtures, browser tests and a separate native probe cannot replace this check.

The pinned compatibility boundary is MCP Apps SDK 1.7.5 with MCP SDK 1.32.1.
See [design.md](design.md), the [official SDK](https://github.com/modelcontextprotocol/ext-apps)
and [plugin packaging](https://developers.openai.com/plugins/build/plugins).
