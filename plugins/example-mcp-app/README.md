# Example MCP App

- **Goal** · Explain what crosses **Main conversation / App panel / Host / MCP server** during one interaction.
- **Outcome** · Choose a scenario, run it, inspect its retained evidence and identify what each response establishes. [Design contract](design.md)

## Two explicit modes

| Mode                | Outcome                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Learn with fixtures | Deterministic labelled success, rejection and timeout examples in standalone and Codex. Zero host requests, context updates or messages.                                                                     |
| Run live            | Installed Codex panel, official SDK bridge and real stdio server. Missing capabilities disable controls. Errors stay visible. Acknowledgment, conversation arrival and model response are separate evidence. |

- **Standalone scope** · Teaching the host bridge is a deliberate exception to the shared MCP practice. Fixture preview starts no MCP server, conversation inbox or RPC proxy. The simulated conversation lives in tests.

## Build and preview

- **Source build** · Node 24.21+ from this directory.
- **Preview** · Self-contained fixture app at `http://127.0.0.1:4390`.

```sh
npm ci --prefix ../mcp-app-runtime --ignore-scripts
npm ci --ignore-scripts
npm run build
npm run preview
```

## Install as a Codex plugin

```sh
npm pack --pack-destination /tmp
npm install --ignore-scripts --omit=dev --no-audit --no-fund \
  --prefix "$HOME/.local/share/example-mcp-app" /tmp/<archive>.tgz
# Add the package to the personal marketplace, then use the desktop-bundled CLI.
codex plugin add example-mcp-app@personal --json
```

- **Marketplace path** · `./.local/share/example-mcp-app/node_modules/@repo-kit/example-mcp-app` relative to the personal marketplace root. Preserve its other entries.
- **Activation** · One registration. Retire the old `mcp_servers.example_mcp_app` entry after verifying the packaged plugin. Reconnect and open **Example MCP App**.
- **Runtime** · `plugin.json` owns identity. `mcp.json` starts stdio from `${PLUGIN_ROOT}`. Only `example_open` advertises the UI and attaches the HTML to metadata and result. Data calls preserve the mounted panel.
- **Compatibility** · MCP Apps SDK 1.7.5 and MCP SDK 1.32.1. [Official SDK](https://github.com/modelcontextprotocol/ext-apps) · [Plugin packaging](https://developers.openai.com/plugins/build/plugins)

## State, boundaries and limits

| Material           | Evidence and limits                                                                                                                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Events             | 250 per transport, 500 merged observations and 30 panel runs. Startup discovery is process-wide. Per-run IDs isolate feature evidence.                                                                                                                                  |
| Model-facing tools | `example_status` shows build/panel identity. `example_events` lists up to 20 summaries. `example_event` reads one exact event pinned to the server instance.                                                                                                            |
| App-only data      | `example_trace` feeds the graph and stays out of ordinary messages. `example_report` retains up to 12 panels for an hour, rejects mismatched builds and filters fixtures. Caller identity gates retained data. Reports are diagnostic claims.                           |
| Payload            | Frozen payload preview truncates after 12,000 characters. HTML is summarized and credential-named fields are masked. Free text is recorded and rendered inert. Use demo data.                                                                                           |
| Capture and export | **Save interaction capture** persists one selected live run under the shared runtime's retention policy. **Export session log** includes the wider retained session via host download or permitted browser download. Fixtures have local inspection and no disk writer. |
| Resource           | Self-contained HTML with build fingerprint, `text/html;profile=mcp-app` and CSP denying external connections/resources.                                                                                                                                                 |
| Build mismatch     | **App info** shows panel and server build fingerprints. Mismatch blocks live actions while fixtures stay available. Reinstall and reconnect to refresh. `dist/release.json` records inputs and emitted-byte hashes.                                                     |

## Verification

| Check                                                                           | Evidence                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                                 | Format, lint, types, bundle, trace and fixture tests, isolated delivered server                                                                                                                                                                                                                                  |
| `EXAMPLE_TEST_PORT=4397 npm run test:browser`                                   | Built app in a disposable Chrome profile, opaque iframe and restrictive CSP. Covers fixture isolation, correlation, failures, capability gates, keyboard, narrow layout, theme, export and teardown. Host conversation/context is simulated. On this Mac, use approved execution outside the restricted sandbox. |
| `EXAMPLE_CODEX_BIN=/absolute/path/to/desktop-bundled/codex npm run probe:codex` | Actual app-server in an ephemeral model-free thread. Installed identity matches `dist/build.json`. HTML resource, echo and same-instance traces work.                                                                                                                                                            |
| Installed desktop acceptance                                                    | Active panel renders, uniquely labelled echo and resource read appear in `example_trace`, and a uniquely labelled message arrives in the owning chat.                                                                                                                                                            |

- **Source owners** · [Example design](design.md#owners) · repo-kit's `plugins/mcp-app-runtime` for shared host lifecycle, masking, disk logs and retention.
