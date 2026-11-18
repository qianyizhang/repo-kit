# MCP Apps

Build an MCP App with a useful standalone mode. Share domain operations,
validation and views across both modes. The host adapter owns host-specific
capabilities; server checks enforce authority. Keep product exceptions in the repo.

- Name the app, host, conversation and server. Show the action's destination
  and scope. Send the user's text as written; freeze any explicitly attached
  context. Ordinary sends need no evidence lookup. Keep summary, exact reads
  and provenance separately scoped.
- Distinguish acknowledgment, completion and uncertain delivery. Apply and Save
  are distinct. Preserve the draft and check delivery before an explicit retry.
- Make the frozen request and observed result inspectable, including failures.
  Inspection never repeats the action. Persist metadata by default; save payloads
  only in an explicit bounded capture. Label omissions and inferred connections.
- Report what was verified: standalone, source build, installed server or active
  panel. A simulated chat or fresh probe cannot verify the actual Codex session.

Use `mcp-app` for implementation, diagnostics and boundary tests; use
`ui-discussion --mcp` for visual review. In the hosted iframe, test without assuming
localhost access, storage, relative assets or History APIs. Use the host bridge,
route external links through the host and keep view state usable without storage.
If form submission is blocked, close dialogs with a `type="button"` control that
calls `dialog.close()`. Check dismissal, Escape and focus return in that host.
