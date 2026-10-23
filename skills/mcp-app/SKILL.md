---
name: mcp-app
description: Build or repair MCP Apps with standalone operation, inspectable conversation integration, shared diagnostics, and boundary tests. Use for MCP App implementation or integration debugging; use ui-discussion for a visual review round.
---

# Build an inspectable MCP App

Read the repository's runtime/design contracts and the applicable MCP Apps practice
guide. Preserve existing product choices. This skill owns the construction and
verification workflow; the guide owns portable principles.

## Establish the action contract

Identify the app, host, main conversation and server. For each user action name its
destination, input scope, effect, acknowledgment and completion evidence. Identify
what remains useful without a host. Treat existing installation and active-panel
versions as separate evidence.

Read [interaction contracts](references/interactions.md) before implementing a
message, tool, state change or diagnostics boundary. Use its explicit status and
payload rules. For a new app, run:

```sh
python3 /path/to/mcp-app/scripts/scaffold.py --target /absolute/new-app --name my-app
```

The command creates a runnable TypeScript starter and tests in a **new directory**;
it installs nothing and does not connect a host. Read the generated `DESIGN.md` and
package scripts. The starter includes a tested npm lockfile; use `npm ci`, or
deliberately translate it when the target requires another package manager.
For an existing app, adapt the relevant starter modules through its
existing owners; do not generate a second app or replace its UI wholesale.

## Wire one owner per boundary

- Keep domain operations behind validated inputs. HTTP and MCP adapters call the
  same operations. Generate the tool catalog from the registration definitions.
- Keep a persistent, accessible **App info (ⓘ)** entry. It opens build/mode,
  connection and capability details, Tools, Conversation flow, and Interactions.
- Record frozen request/result observations at the real app/server boundary.
  Persist metadata by default, keep payloads live, and save payloads only through
  an explicit capture of the selected interaction. Disclose loss on restart.
  Inspect one interaction and one event at a time; diagnostics never enter chat
  automatically. Read [observability](references/observability.md) for log paths,
  retention, redaction, gaps and exactness limits.
- Capture the draft and selected context when sending. Dispatch the text itself;
  “hi” has no evidence read. Preserve newer drafts and uncertain sends. Keep
  domain work available in standalone mode; label copy/export as copy/export.

The starter uses small fixture notes to demonstrate these mechanics. Replace its
domain operations and fixtures with the product's operations, keeping the
boundary tests relevant. Its SDK observations are not a wire sniffer or a view
into the host's private model input. Read the pinned SDK's contracts when adapting
capabilities, resource packaging, theme, teardown or error handling.

## Prove the contract

Read [testing](references/testing.md). Run the generated unit/protocol tests and
browser tests against both standalone HTTP and an SDK host with an opaque iframe.
Inspect the rendered Info, Tools, Conversation flow and Interactions views. Test
the actual product handlers, not only the reusable recorder or a permissive mock.

For a full visual review, use `ui-discussion` with its MCP integration supplement.
Include all registered tools, representative payload fixtures and an ordered
sequence through the app/host/conversation/server roles. Label fixtures as fixtures.

Report separately: source checks, delivered package, installed server and live host
acceptance. A test-host acknowledgment does not prove a Codex turn. Finish within
the authorized scope; migration, installation and publication retain their normal
authorization boundaries.
