# MCP App runtime

- **Goal** · Share host lifetimes, caller scope, diagnostics and polling across Workbench and Example.
- **Delivery** · Internal source bundled into each independent plugin archive. `npm ci` here provides source-build dependencies.

## Contract declared before implementation

| Owner                     | Fixed inputs                                                                               | Outcome                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HostSession`             | Instance identity, app declaration, actions, timeouts, callbacks and observed capabilities | Connect once, invoke and dispose. Reconnect with a new instance. Late completions cannot publish. Dispatched message failures are uncertain unless explicitly rejected. |
| `ScopedRegistry`          | Count, bytes, age, scope policy and disposal callback                                      | Create, resolve/list for the caller, release and close. Hosted identity is required. Trusted local scope is declared by the adapter.                                    |
| `Recorder` and `LogStore` | Schema, masking, retention and session identity                                            | Freeze observations, expire whole interaction groups by class, protect user actions from background eviction and persist metadata. Payload capture is explicit.         |
| `Poller`                  | Interval, maximum backoff, visibility and task                                             | One read at a time. Hidden pages suspend background reads. Stop aborts reads and clears timers/listeners.                                                               |

- **State** · Plain data is deeply frozen on input. Mutable state stays private. Public snapshots are detached. Policy changes require a new lifetime. Products own domain validation, draft recovery, report adoption and display.
- **Host protocol** · SDK adapter owns the connection. Controlled tests exercise the same interface. Browser suites exercise the SDK bridge. Wire IDs are source-local. Explicit interaction/call IDs correlate participating boundaries.

## Diagnostic retention

| Material         | Policy                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live payload     | Masked, bounded memory. Inspect retained coverage by interaction.                                                                                          |
| Disk metadata    | `${XDG_STATE_HOME:-~/.local/state}/mcp-apps/<app-id>/<instance>/` unless `MCP_APP_LOG_ROOT` overrides it. Rotate at 2 MiB per source, with one prior file. |
| Explicit capture | One retained interaction at a time. Up to eight files of 2 MiB per session. Capture never rereads sources or replays effects.                              |
| Startup cleanup  | Recognized inactive directories only. Up to eight inactive sessions for seven days. Active processes are excluded.                                         |

## Shared sources and verification

- **Source owner** · [MCP App skill shared sources](../../skills/mcp-app/assets/shared) for files, masking and caller identity. Plugin builds bundle them and fingerprint their inputs.
- **Generated starter** · Independent copied source and dependencies. Keeps 250 browser and 500 server events. Preserves explicit capture and caller scope. Starter CI checks behavior. Skill lock checks integrity.
- **Native fixture** · `tests/host-client.ts` provides test-only host identity for both plugin suites.
