# `__APP_ID__` starter

This fixture note browser is a starting point for a domain app. The same tools
serve standalone HTTP and an embedded MCP App. Replace the note data and handlers
with your product; keep the interaction contracts and relevant tests.

The header owns app identity, connection status and persistent App info (ⓘ).
The workspace owns note selection and the message draft. The Info dialog owns
metadata, the generated tool catalog, conversation fixtures, and interaction
inspection. Every send provides an Inspect last send entry. Payloads remain
selectable JSON; diagnostic details do not crowd the workspace.

Message acceptance is distinct from an assistant reply. Attach selected note starts
off. Sending freezes exact text and the selected excerpt; later edits survive an
older acknowledgment. Delivery uncertainty retains the draft and never auto-retries.
Standalone mode browses notes and prepares/copies the same message without claiming
to send it. Embedded initialization failure remains explicit.

The server writes app/server JSONL under
`${XDG_STATE_HOME:-~/.local/state}/mcp-apps/__APP_ID__/<instance>/`.
`MCP_APP_LOG_ROOT` overrides the root above the app ID. Each source rotates at
2 MiB with one previous file. Startup prunes only recognized inactive sessions,
keeping at most 8 and at most 7 days; live processes are excluded. Payloads mask
credential-named fields and retain up to 64 KiB in bounded live memory. Only
metadata is persisted automatically. Payloads can be lost when the session ends.
Selecting an observation enables **Save diagnostic capture**, which writes only
that interaction's currently retained payloads. Captures are capped at 8 per
session and 2 MiB each, with the same session retention. Limits and write failures
remain explicit. Logs are local, not model context. App info shows persistence
failures and coverage limitations.

Run `npm ci` with the included lockfile, then `npm run check`, `npm run dev` for
standalone mode (loopback port 4397 by default), and `npm run test:browser` for the
fixture host. Register `node /absolute/path/dist/server.mjs` as the MCP server when
installation is authorized. The opening tool is `app_open`. Build changes give
the UI resource a new fingerprint. Source tests do not prove installation or live
Codex acceptance. The test host is explicitly simulated and never starts a model.

The HTTP adapter accepts only same-origin JSON POSTs with a page nonce. It is a
local companion, not a remotely authenticated service. Before remote deployment,
bind your existing authentication and authorization at that adapter.
