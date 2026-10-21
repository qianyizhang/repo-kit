# MCP Apps in Codex

Use an MCP App when a repository tool needs a shared visual interface beside the current Codex conversation. The MCP server owns repository operations; the iframe owns interaction; the existing conversation supplies reasoning. Sending a message from an app does not require another agent, API key, or direct model call.

This guide records the Repo Canvas and Saul integration lessons verified on 2026-10-13. Package-specific commands and limits live in the [Repo Canvas README](../packages/repo-canvas/README.md).

## Choose the process lifetime first

| Transport       | Who starts it                     | Appropriate use                                   | Caveat                                                                 |
| --------------- | --------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| Stdio           | Codex runs the configured command | Local companion apps such as Repo Canvas and Saul | Use absolute executable/script paths; reserve stdout for MCP JSON-RPC. |
| Streamable HTTP | A separately managed service      | Shared services or a deliberate local preview     | Registration only stores the URL. It does not keep the service alive.  |

For local tools, prefer stdio unless a persistent HTTP service is already managed. Pin a compatible runtime and explicit repository argument; the desktop may have a different PATH and working directory from a shell. A process started by a development terminal can disappear when that terminal or app exits. Exit when the host closes stdin. Keep diagnostic logs on stderr.

Keep initialization inexpensive. Repo Canvas loads its prebuilt, self-contained HTML lazily and caches it per process. Consumers need no compiler or build dependencies. A long-lived process retains old code/resources until reconnected; changing a resource URI alone cannot refresh its executable or tool catalog.

## Separate discovery, rendering and data

The server exposes a render tool, a registered HTML resource, and data tools. Only the render tool needs `_meta.ui.resourceUri`; attaching a UI template to every data operation can cause needless remounts.

The Repo Canvas entrypoint uses:

```ts
_meta: {
  ui: { resourceUri: APP_URI },
  'openai/ui': { entrypoints: [{ type: 'thread' }] },
}
```

`APP_URI` includes the packaged build fingerprint. The resource returns the exact matching URI, `mimeType: 'text/html;profile=mcp-app'`, and complete HTML. Repo Canvas embeds its compiled JS/CSS and declares empty resource/connect domain lists. It therefore needs no localhost fetches from the iframe. OpenAI entrypoint/display metadata is host-specific; feature-detect capabilities rather than assuming every MCP client implements it.

App-only tools use `_meta.ui.visibility: ['app']`. This controls host exposure, not authorization against another local process. Validate data, source paths and write preconditions on the server regardless of caller.

## Route discussion through the owning chat

```text
Canvas -- tools/call --> server captures request + unsaved map
Canvas -- ui/message --> current Codex conversation (request ID + question)
Codex  -- canvas_read --> server returns captured context
Codex  -- canvas_reply --> server stores answer and optional proposal
Canvas -- tools/call --> shows answer; person reviews, applies and saves
```

Repo Canvas uses `App` from `@modelcontextprotocol/ext-apps` for protocol negotiation, request correlation, notifications, sizing and teardown. Register handlers before connecting. Keep repository selection and reconnect policy outside the SDK adapter. Check the host message capability before sending `role: 'user'` text through `sendMessage`; this is a user action routed by the host, not a server-side model call.

Both transports use the same operation schemas. Validate results before applying them to UI state. The SDK host fixture exercises the delivered HTML under an opaque iframe origin with network access blocked by CSP. It supplies host theme changes and enforces the actual protocol schema. Runtime validation and strict TypeScript serve different boundaries; keep both.

A timeout means delivery is uncertain. Do not automatically resend a message: it may already have started a turn. Show an actionable error and let the person inspect the main chat. Closing an app request only closes its local mailbox; it does not cancel the native conversation. Treat map text and source content as data, never privileged instructions.

## Make state and review explicit

- Keep one persistent authority: Repo Canvas uses the versioned architecture file. Save validates the schema, encoded size and base revision before replacement.
- Distinguish saved data, an unsaved draft and a proposed change. Applying a proposal updates the draft; saving updates the repository. Reject a stale proposal rather than overwriting intervening edits.
- Keep request IDs and captured context stable across the round trip. Reject duplicate or late replies to closed requests.
- Temporary server state disappears on restart. Separate stdio processes share saved files, not in-memory conversations or drafts. Repo Canvas currently retains one latest recovery draft per server process; it is not a multi-editor draft store.
- Clear recovery data after saving or discarding it. Validate navigation after undo/import/proposal replacement so a removed selection cannot break the UI.

## Diagnose the failing layer

| Evidence                                      | Meaning                          | Next action                                                            |
| --------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------- |
| Config entry exists                           | Registration only                | Verify actual startup/handshake.                                       |
| HTTP initialization fails; no listener        | Service is unavailable           | Start its managed service or use stdio.                                |
| App menu entry exists                         | An entrypoint was discovered     | Check the target chat's tool and resource calls.                       |
| `unknown MCP server`                          | Target runtime lacks that server | Refresh that runtime's registration; HTML/CSP changes cannot help yet. |
| `Unknown tool` or resource `Method not found` | Possibly an older server/catalog | Compare fresh and attached server capabilities.                        |
| Resource read succeeds, iframe fails          | Component/host bridge issue      | Inspect bundle, initialization, CSP and capability errors.             |
| Tool transport succeeds with `isError: true`  | Operation failed                 | Inspect the tool result, not just transport logs.                      |

Codex's app-server API documents `config/mcpServer/reload`, scoped to that running app-server. Starting a new app-server and calling reload there does not refresh the desktop's existing process. If no supported reconnect action is reachable, fully quit/reopen the desktop and return to the same chat. Preserve drafts first. Retrying a panel or closing one window can keep the same connection.

On macOS, desktop logs are under `~/Library/Logs/com.openai.codex/YYYY/MM/DD`. Inspect `mcpServer/tool/call` and `mcpServer/resource/read` separately. Sanitize paths, repository content, credentials and conversation identifiers before publishing a report.

## Verify the complete path

1. **Fresh protocol probe:** initialize, list tools, inspect entrypoint metadata, call the render tool, read its exact resource. For Repo Canvas, run the packaged MCP probe in `npm run test:package`.
2. **Isolated browser host:** render the delivered HTML under an opaque iframe origin; forward real tool calls; exercise messages, errors, proposals, conflicts and save/reload. Use the repository's disposable-profile harness.
3. **Actual desktop conversation:** open the app, send a small message, read its captured request in that same chat, return a reply, and confirm delivery. A fresh SDK probe or browser harness alone cannot establish this.

Historical Repo Canvas acceptance exercised all three layers; each new release still needs its own installed-host check. The native round trip was confirmed when an app-origin “ok” arrived in the existing chat and `canvas_reply` reported delivery. Two earlier failures were distinct: a stale chat registration while the HTTP server was healthy, and a later stopped development server. Stdio fixed the lifetime dependency; the revised registration then supported the native round trip. This does not isolate the desktop's internal stale-registry cause. The [consolidated upstream report](https://github.com/openai/codex/issues/20605#issuecomment-6146903975) preserves that distinction.

## References

- [Official MCP configuration](https://developers.openai.com/codex/mcp): stdio and HTTP registration and process settings.
- [MCP Apps UI guide](https://developers.openai.com/plugins/build/chatgpt-ui): resource metadata, standard bridge, state ownership and rendering separation.
- [App-server reference](https://learn.chatgpt.com/docs/app-server): runtime-scoped reload operation.
- [Plugin troubleshooting](https://developers.openai.com/plugins/deploy/troubleshooting): server, discovery and component checks.
