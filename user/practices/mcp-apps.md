# MCP Apps

- **Goal** · Useful standalone and hosted modes with shared operations, validation and views. Host adapter owns host capabilities, server enforces authority, and repositories own product exceptions.
- **Roles and scope** · Name app, host, conversation and server. Show action destination and scope.
- **Send** · User text as written. Freeze only explicitly attached context. Scope summary, exact reads and provenance separately. Ordinary sends need no evidence lookup.
- **Outcome** · Distinguish acknowledgment, completion and uncertain delivery. Apply and Save stay distinct. Preserve the draft and inspect delivery before deliberate retry.
- **Inspection** · Frozen request, observed result and failure details without replay. Persist metadata by default and payloads only in explicit bounded captures. Label omissions and inference.
- **Acceptance** · State which of standalone, source build, installed server and active panel was exercised. Verify actual Codex delivery in its owning conversation.
- **Hosted iframe** · Use the host bridge and route external links through it. Keep views usable when localhost, storage, relative assets or History APIs are unavailable. If forms are blocked, use a `type="button"` action calling `dialog.close()`. Verify dismissal, Escape and focus return.
- **Workflows** · `mcp-app` for implementation, diagnostics and boundary tests. `ui-discussion --mcp` for visual review.
