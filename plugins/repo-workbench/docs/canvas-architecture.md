# Repo Canvas architecture and agent controls

- **Goal** · A semantic map that supports safe, source-backed revision by humans and agents. [Canvas design](canvas-design.md)
- **Discovery** · Folder scaffolds are breadth-first, with truncation visible. Curated maps show responsibilities, precise verbs, sources and boundaries, with detail nested in scope.

## Document and writes

| Material                      | Accepted behavior                                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved map                     | v3 only. Older or invalid bytes stay intact. Offer offline repair or Start new draft. Explicit Save compares the raw disk revision.                                                                                                                                                                                                   |
| Node kinds and fields         | Built-in system, package, module, data, external, process, interface and concept roles. Repo-owned `nodeTypes` use `text`, `number`, `boolean`, `enum` or `source` fields on one primary surface (`card`, `peek`, `details`). Peek moves to Details when pinned. Card fields appear once. Preserve unknown data as readable fallback. |
| Field migrations              | Review affected nodes before deletion or value-type change. Explicit migration acceptance before dropping values, including in agent proposals.                                                                                                                                                                                       |
| Relationships and annotations | Directed verbs, optional kind/explanation/sources. Annotations target `{kind:"node"\|"connection",id}` and keep severity and intent separate.                                                                                                                                                                                         |
| Contextual comments           | Freeze target (node, relationship or annotation), scope, sources and document hash. Queue for explicit Send to chat. Saved map notes remain a separate action.                                                                                                                                                                        |
| Source save                   | Existing, explicitly referenced, Git-visible UTF-8 file. 500,000-byte input/output limit and 40,000-character block limit. Regular file with no symlink component or hardlinks. Compare full-file revision at atomic replacement. Preserve surrounding lines, file mode and newline style. Reload and review conflicts.               |
| Write concurrency             | Map and source saves share a worktree-local SQLite writer lock in the Git directory. Competing Workbench writers get a conflict. External editors are outside that lock, so source saves also check the disk revision.                                                                                                                |

## Discussion recovery

- **Storage** · Private `$XDG_STATE_HOME/repo-workbench/discussions` (default `~/.local/state`), partitioned by canonical repo and trusted chat ID. Standalone uses a separate namespace.
- **Retention** · Drafts, frozen comments and up to 100 exchanges. Earlier exchanges fold beneath the latest question. Clear only on request, after closing pending requests.
- **Writes** · Atomic JSON replacement, with revision comparison inside a SQLite transaction. OS lock release recovers a killed writer. Legacy orphan lock folders remain untouched.
- **Uncertain sends** · Preserve the request. Require a deliberate resend. Map recovery remains browser-tab/server-context state. [Connection recovery](mcp-apps.md#canvas-connection-and-recovery)

## View and agent controls

| Capability             | Outcome                                                                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fit and layout         | Center full bounds with reserved control space. Offer 100%, Fit selection and undoable Arrange for pane aspect ratio. Preserve manual pan/zoom on resize. Refit changed node sets before paint. |
| Compact and dense maps | Collapse navigation below 1100 px with Browse/Close accessible. Dense edge labels appear on focus/selection. Vertical links join nearest faces.                                                 |
| Multiple selection     | Explicit Select several and modifier-click. Side chat includes all selected IDs and names. Preserve native gestures and keyboard focus.                                                         |
| Snapshot               | Timestamp/freshness, selected IDs, scope, viewport, panels, dirty/conflict state, visible nodes and command receipts.                                                                           |
| View command           | Exact-revision, original-scope command queues until acknowledged. Verify through the next snapshot. Acknowledgment retries avoid replay. View commands never save.                              |
| Proposal               | Compare with captured document before Apply. Save requires a separate user action. [Proposal comparison](canvas-proposal-comparison.md)                                                         |
| Evidence               | Browser tools own DOM and screenshots, including transient dialogs. The Canvas SDK exposes semantic commands only.                                                                              |

- **Deferred** · Named multi-view maps, lasso selection and freeform highlights. Add drawing primitives only for evidenced workflows.
