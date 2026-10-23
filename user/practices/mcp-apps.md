# MCP Apps

Build each interactive tool in two modes: a standalone app and a Codex MCP App.
Share domain operations, state rules and views; adapt transport and host controls.
A development host can exercise integration, but simulated chat is not native
Codex acceptance. Read the repository's design and runtime contracts first.

## Build and review

Use the `mcp-app` skill for implementation and integration debugging. It owns the
build sequence, observability starter, payload/status contracts and boundary tests.
Use `ui-discussion --mcp` for a visual review with a tool catalog, conversation
fixtures, data-flow sequence and standalone/logging coverage. Keep domain-specific
commands and exceptions in the product repository.

## Action and evidence principles

- **Honor the action.** Send the user's text directly to the owning conversation.
  Context attachment is explicit, frozen and bounded; ordinary messages require
  no evidence lookup. Summaries, exact source reads and provenance have distinct
  scoped APIs. Fetch provenance only when needed. Apply and Save remain separate.
- **Make the boundary visible.** Name the app, host, main conversation and server.
  Show destination, scope and meaningful status. An acknowledgment is evidence of
  acceptance, not an assistant reply or a completed external effect.
- **Keep one owner.** Domain operations and schemas serve both HTTP and MCP;
  server validation enforces authority. Generate the catalog from registrations.
  App-only visibility is discovery metadata, not authorization.
- **Make interactions inspectable.** Keep App info (ⓘ) available. Expose build,
  mode, connection/capabilities and canonical log location. Let users inspect the
  frozen request/result of each action, including failure. Label redaction,
  truncation, missing observations and recording failure. Logs remain outside
  ordinary model context; inspection must not repeat the action. Persist metadata
  by default, inspect payloads live, and save payloads only for an explicitly
  selected diagnostic capture. Explain that uncaptured payloads can be lost.
- **Keep evidence honest.** Correlate observed boundaries through explicit IDs.
  Local receipt order is not proof of cross-process causality. Distinguish live
  observations, deterministic fixtures and unobserved host/model work.
- **Prove the delivered route.** Source, package, installed server and active panel
  are different acceptance layers. Test standalone operation and the real host
  adapter, then report exactly which layers were verified.

## Footguns

- **Sandbox assumptions:** iframe localhost fetches, relative assets, localStorage
  and History APIs may fail. Use the host bridge; keep view state usable without
  storage, and route external links through the host when embedded.
- **False success:** transport success can contain `isError`. Parse the result.
  Message acknowledgment means accepted delivery, not a completed model reply.
  On timeout, show uncertain delivery and preserve the draft and selected context;
  never auto-resend.
- **Invented traces:** a host acknowledgment is not an observed conversation/model
  event. Wire IDs and clocks may be local to a boundary; correlate across boundaries
  only with explicit evidence and label inferred links. Preserve receipt order in
  the log. A completed response is not a token stream; do not animate invented
  chunks or fill unobserved steps with synthetic events in a live view.
- **Stale state:** guard asynchronous results after switching/closing; pin lazy
  source reads to their revision. Refreshing must not overwrite a newer draft.
- **Oversharing:** keep full payloads out of routine model results and diagnostics.
  Load bodies/images on demand; bound retained contexts, messages and logs.
- **Stale installation:** source, package, cached server and active panel can be
  different builds. Report each verified layer; restarting a separate probe
  does not reload the desktop's server. Preserve drafts before reconnecting.

Source reviews: `docs/reviews/2026-10-22-mcp-apps.md` and
`docs/reviews/2026-10-23-ui-build-prevention.md` in repo-kit.
Keep product-specific commands and exceptions in their repository.
