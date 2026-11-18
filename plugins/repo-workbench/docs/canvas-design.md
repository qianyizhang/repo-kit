# Repo Canvas design: Little Clarity adaptation

- **Goal** · Onboard and discuss design through a faithful map of core concepts, use cases and data flow.
- **Outcome** · View architecture → inspect source → discuss → review → apply → save. Small overview, nested detail and evidence attached to claims.

## Source and provenance

- **Upstream** · Qianyi Zhang's [Little Clarity DESIGN.md](https://github.com/qianyizhang/Saul/blob/a0b81e40e6bbf5b72486eb0322e7b1dd586dc8f5/DESIGN.md), Saul `alpha`, commit `a0b81e40e6bbf5b72486eb0322e7b1dd586dc8f5`, blob `bee59d0053de95aa744dd4d5802dd3f239552243`. Adapted 2026-10-15. EZ was the initial upstream visual reference.
- **Scope** · Public roles and principles implemented in Canvas's React/CSS. Review the pinned source and local mapping together for future updates.

## Roles and adaptations

| Role       | Upstream dark value | Canvas use                           |
| ---------- | ------------------- | ------------------------------------ |
| Canvas     | `#20211f`           | Diagram plane and input background   |
| Surface    | `#292b27`           | Header, explorer, inspector and chat |
| Subtle     | `#30332e`           | Secondary controls and hover         |
| Ink        | `#e8e9e2`           | Primary content                      |
| Muted      | `#b3b9ae`           | Captions and secondary content       |
| Line       | `#454b40`           | Dividers and panel boundaries        |
| Primary    | `#6ec2a1`           | Save, selection and focus            |
| On primary | `#14251d`           | Primary action text                  |
| Wash       | `#253d31`           | Selection and proposal context       |

- **Appearance** · `styles.css` implements the roles. Neutral module surfaces, category text and functional emphasis on connections. Hosted panels follow the host theme. Standalone follows the OS.
- **Type** · System sans, 13 px controls, 12 px captions, 15 px chat answers at 1.65 line height. Retain diagram zoom and Fit view.

## Hierarchy and disclosure

| Surface                    | Design outcome                                                                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header                     | Breadcrumb as the single scope name. Visible checkout path, mode (`MCP host session` or `Standalone preview`), saved/draft state and Save at every width.                                                                                                                 |
| Toolbar and compact layout | Direct Inspect and Side chat. Active panel stacks below architecture at narrow widths with explicit Close, wrapping text and clear navigation and controls.                                                                                                               |
| Canvas and object menus    | Creation, Undo, Export, Import and Reload via right-click, Shift+F10 and overflow. Contextual comments bind stable node, original relationship or note IDs.                                                                                                               |
| Cards and details          | Type, name, up to two custom fields, note badge and child count or leaf add-child action. Hover/focus explains, click pins and suppresses hover for that node. Details, Notes and Sources tabs. Edit replaces reading with Apply edits and Cancel.                        |
| Notes                      | Risk, warning and info use text and red, yellow and neutral roles. Separate decision/question intent. Badge opens Notes. Edit and remove are undoable.                                                                                                                    |
| Navigation and groups      | Leaves hidden by default and revealed by search or Show leaf nodes. Adding a child keeps the parent ID. Overlapping sibling groups dim others by default. Hide masks without moving nodes. Spatial lanes are deferred.                                                    |
| Sources                    | File or `path#L10-L25`, syntax colors and original line numbers. Before/after diff and explicit Save source file. A returned range updates the current draft only if the object and original reference still match. Notice shows the range and whether the draft updated. |
| Proposals                  | Apply stays beside the reviewed proposal. Save remains explicit in the header. [Comparison contract](#proposal-comparison)                                                                                                                                                |

## Minimal action controls

- **Icons** · Conventional, consistent 14–16 px strokes with targets ≥28 px, accessible names, hover tooltips and visible keyboard focus. Label unfamiliar or consequential actions.
- **Connection actions** · Copy, refresh and log export beside the disclosure title. Report copy success only when confirmed. Provide selectable text if blocked.
- **Visual emphasis** · Use spacing and type hierarchy. Keep branding, module numbering and repeated network labels out of work surfaces.

## Proposal comparison

**Review changes** opens one read-only dialog for MCP proposals and discussion replies. Before, Changes and After share one change list and one map. Apply remains outside the dialog.

| Contract        | Acceptance                                                                                                                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basis           | Before uses the captured document. Stale proposals remain inspectable with Apply disabled. Close restores trigger focus. Review preserves draft selection, navigation and history.                                                                                            |
| Identity        | Compare stable identities across nested nodes, original connections, annotations, groups, type definitions and title. Overview links preserve original relationship IDs.                                                                                                      |
| Changes         | Show exact values and scope for meaning, structure, evidence and position changes. Mark missing entities and scopes. For removals, show the baseline.                                                                                                                         |
| Ordering        | Reordering entities, sources or members produces no display change. Field-definition order can affect presentation. Exact-basis conflicts are checked separately.                                                                                                             |
| Layout          | Show one valid snapshot at a time, with authored positions and readable pan and zoom. Narrow views stack the list and map with the same controls.                                                                                                                             |
| Captured intent | Preserve the originating question and frozen comments with target and revision. Raw JSON provides detail. Map notes and comment resolution have separate owners.                                                                                                              |
| Labels          | Show inline labels where they clear cards and other labels. Clip or ellipsize wide text. Full names remain available in accessible link controls and inspection. Screen-scale hover stays inside the pane and closes on selection. Dense labels appear on selection or focus. |

- **Evidence limit** · Identity changes appear as additions and removals. Runtime impact needs source evidence. [Canvas verification](../README.md#canvas-verification)

## Repository selection

| Input or state              | Outcome                                                                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat workspace available    | Resolve from native metadata and saved workspace without a chat message. [Connection contract](mcp-apps.md#canvas-connection-and-recovery)                                                                  |
| Chat ID without workspace   | Explain the missing context and show the picker. Retry 5 seconds after success, back off on failures to 40 seconds, pause while hidden. Retry immediately on request and show progress and completion time. |
| Manual selection            | Wins over pending lookup and later workspace metadata. Explicit targets only.                                                                                                                               |
| Registered repos            | Show named canonical repos. Search names/paths. **Add another repository** discloses manual entry. Explain an empty list. Refresh while choosing under the same polling policy and preserve open targets.   |
| Standalone                  | Same registry without chat actions.                                                                                                                                                                         |
| Selected repo fails to load | Offer **Retry loading map**. The separate connection retry checks host context only.                                                                                                                        |

## Purpose and initialization

- **Trigger** · **Initialize architecture** explicitly asks the owning chat to model an unsaved repo. Opening a repo alone triggers no request.
- **Evidence** · Instructions, relevant files/docs, bounded recent commits and available prior sessions. Disclose unavailable history.
- **Outcome** · Proposal of important and discussed features, eligible for review, Apply and Save. Standalone explains the connected-chat requirement.

## Implementation owners

| Owner                                           | Responsibility                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `useCanvasDocument`                             | Drafts, revision conflicts, history and saves                                                                      |
| `RepositoryPicker`                              | Repository selection UI                                                                                            |
| Draft transition module                         | Valid navigation for human and agent commands. Undo restores history and retains valid navigation.                 |
| Shared proposal review                          | Captured-basis comparison, proposal-bound migration consent and draft-only Apply across MCP and discussion replies |
| [Architecture contract](canvas-architecture.md) | Map semantics, editing safety and agent controls                                                                   |
| [MCP integration](mcp-apps.md)                  | Host connection, transport and diagnostics                                                                         |

## Interaction inspection

- **App info** · [Diagnostics inspector](mcp-apps.md#connection-diagnostics), including standalone.
- **Cancel discussion request** · Cancel the local request. An active Codex turn can continue.
