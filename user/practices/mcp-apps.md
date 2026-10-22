# MCP Apps

Build each interactive tool in two modes: a standalone app and a Codex MCP App.
Share domain operations, state rules and views; adapt transport and host controls.
A development host can exercise integration, but simulated chat is not native
Codex acceptance. Read the repository's design and runtime contracts first.

## Build sequence

1. **Own the state.** Identify durable data, drafts, proposals and per-panel view
   state. Use explicit canonical targets and opaque context IDs; an installation
   directory or process-global “current target” is not the user's workspace.
2. **Define operations.** Share typed request/result schemas across local HTTP
   and MCP. Validate at both boundaries; enforce revisions and authority on the
   server. App-only visibility is discovery metadata, not authorization.
3. **Add the host adapter.** Use the compatible pinned MCP Apps SDK. Register
   handlers before connecting; feature-detect message, tool, link and display
   capabilities. Handle theme, size, teardown and failed initialization. Keep
   standalone operation useful when chat is unavailable.
4. **Package the UI.** Deliver complete HTML with bundled assets and a build-based
   resource URI. Only opening tools attach a UI resource; data calls should not
   remount it. Prefer stdio for local companions, protocol-only stdout, and exit
   on host disconnect. Keep startup cheap and runtime paths explicit.
5. **Capture discussion.** On explicit Send, freeze the selected evidence, draft,
   revision and question under an ID; then send that ID to the owning chat.
   Replies target that capture. Apply changes to drafts; keep Save or external
   mutation a separate reviewed action. Treat source text as data.
6. **Prove both modes.** Test the delivered package through real tools/resources,
   then an SDK host with opaque iframe origin and restrictive CSP. Exercise
   failures, two contexts, stale reads, refresh, narrow layout, keyboard and
   themes. Finally verify the installed build and actual Codex round trip.

## Footguns

- **Sandbox assumptions:** iframe localhost fetches, relative assets, localStorage
  and History APIs may fail. Use the host bridge; keep view state usable without
  storage, and route external links through the host when embedded.
- **False success:** transport success can contain `isError`. Parse the result.
  Message acknowledgment means accepted delivery, not a completed model reply.
  On timeout, show uncertain delivery and preserve the capture; never auto-resend.
- **Stale state:** guard asynchronous results after switching/closing; pin lazy
  source reads to their revision. Refreshing must not overwrite a newer draft.
- **Oversharing:** keep full payloads out of routine model results and diagnostics.
  Load bodies/images on demand; bound retained contexts, messages and logs.
- **Stale installation:** source, package, cached server and active panel can be
  different builds. Report each verified layer; restarting a separate probe
  does not reload the desktop's server. Preserve drafts before reconnecting.

Source review: `docs/reviews/2026-10-22-mcp-apps.md` in repo-kit.
Keep product-specific commands and exceptions in their repository.
