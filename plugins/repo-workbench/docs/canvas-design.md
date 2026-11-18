# Repo Canvas design: Little Clarity adaptation

This contract applies to Repo Workbench’s `packages/repo-canvas`. The main path is **view architecture → inspect
source → discuss → review a proposal → apply and save**.

The map is a simplified but faithful architecture and feature-design view for
onboarding and design discussion. Show core concepts, use cases and data flow.
Prefer a small overview and selected nested concepts; supporting files and
artifacts belong in source references, not separate nodes.

This contract owns the accepted reading, contextual authoring and grouping
decisions. [Review notes](../../../docs/reviews/README.md) retain the brief rationale.

Map and source saves share a worktree-local SQLite writer lock in the Git directory.
A second Workbench writer gets a conflict rather than overwriting an accepted revision.
External editors do not take this lock. Source saves still check the on-disk revision
and reject a resulting file larger than 500,000 UTF-8 bytes before replacement.

## Source and provenance

Adapted on 2026-10-15 from Qianyi Zhang's public
[Little Clarity DESIGN.md](https://github.com/qianyizhang/Saul/blob/a0b81e40e6bbf5b72486eb0322e7b1dd586dc8f5/DESIGN.md)
in `qianyizhang/Saul`, contract version `alpha`, commit
`a0b81e40e6bbf5b72486eb0322e7b1dd586dc8f5`, file blob
`bee59d0053de95aa744dd4d5802dd3f239552243`.
The source describes EZ as its initial visual reference. The user's remembered
`ez/docs/design.md` was accessible and confirmed that Saul owns the shared contract;
no private application content or configuration is copied here.

This is a scoped adaptation of the public roles and principles, not a synchronized
installation of Saul's generator kit. Repo Canvas keeps its existing React/CSS
implementation and semantic color roles. Hosted panels follow the host light/dark theme without a theme control; standalone previews follow the OS. No sibling checkout, token generator, new
package or native application is required. Future updates should review the pinned
source and this mapping together rather than silently claiming upstream parity.

## Roles and adaptations

| Role       | Upstream dark value | Repo Canvas use                         |
| ---------- | ------------------- | --------------------------------------- |
| Canvas     | `#20211f`           | Architecture plane and input background |
| Surface    | `#292b27`           | Header, explorer, inspector and chat    |
| Subtle     | `#30332e`           | Quiet secondary controls and hover      |
| Ink        | `#e8e9e2`           | Primary content                         |
| Muted      | `#b3b9ae`           | Readable captions and secondary content |
| Line       | `#454b40`           | Dividers and panel boundaries           |
| Primary    | `#6ec2a1`           | Save, selection and keyboard focus      |
| On primary | `#14251d`           | Text on the primary action              |
| Wash       | `#253d31`           | Selection and proposal context          |

The CSS custom properties at the top of `styles.css` implement these roles. Use
neutral module surfaces; category names remain text rather than unrelated blue,
purple or brown bands. Spatial connections retain their functional emphasis.

Use the breadcrumb as the single scope identity. Navigation, module names and controls stay system sans. Compact architecture controls use 13 px; captions use 12 px;
chat answers use the upstream 15 px reading size and 1.65 line height. These are
intentional density adaptations from the upstream 24/15/14/12 px scale. Canvas
zoom still scales the diagram; preserve zoom and Fit view controls.

## Hierarchy and disclosure

- Keep checkout path, host mode and saved/draft state in the header at every width.
  A hosted iframe is not proof of a real Codex connection. Use `MCP host session`
  or `Standalone preview`; do not infer liveness from decorative indicators.
- Give Inspect and Side chat direct toolbar access. Save remains in the header.
  Apply remains beside its reviewed proposal and never silently writes the map.
- Put creation, Undo, Export, Import and Reload in the canvas context menu. Right-click,
  Shift+F10 and the compact overflow button expose the same actions. Object menus
  attach comments to a stable node, original relationship or note ID.
- Cards identify: type, name, at most two custom fields, a note badge and child count
  or a leaf's add-child action. Do not repeat responsibility paragraphs on cards.
- Hover/focus explains nodes and links. Click pins reading; suppress a node's hover
  while its details are pinned. Details, Notes and Sources are separate tabs.
  Explicit Edit replaces reading, with Apply edits and Cancel.
- Risk, warning and info are red, yellow and neutral note severities, with text labels.
  Decision/question are separate intents. Notes can be edited or removed; map Undo
  restores them. Note badges open Notes directly.
- Navigation hides leaves by default; Show leaf nodes and search reveal them. Adding
  a child promotes the same existing node to a parent without changing its ID.
- Groups reference existing sibling nodes in one scope. Membership may overlap.
  The compact selector dims other nodes by default; Hide masks them without moving
  any node. Spatial lanes are deferred.
- Source references accept a file or `path#L10-L25`. Render syntax colors and original
  line numbers. Inline editing requires a before/after diff and explicit Save source
  file. File saves and map saves are independent. A returned range updates the
  current draft only while the same object still contains the original reference.
  The save notice shows the new range and whether the draft was updated.
- Remove repeated branding, ornamental module numbers and repeated network labels.
  Use spacing and type hierarchy rather than nested decorative cards.
- At narrow widths, stack the active inspector/chat below the architecture. It must
  not cover navigation, Save or the canvas controls. Give each panel an explicit
  close action. Preserve text wrapping and visible state; avoid horizontal overflow.

## Minimal action controls

Prefer conventional symbols for familiar actions such as information, copy,
refresh, download, undo and close. Use a consistent stroke style, a quiet
14–16 px glyph and at least a 28 px control target. Every icon-only control needs
an accessible name, a hover tooltip and a visible keyboard focus indicator.
Keep explanatory labels for unfamiliar or consequential actions. Put connection
copy, refresh and log export together beside the disclosure title. Report copy
success honestly; if the host blocks clipboard access, expose selectable text.

## Repository selection

A new panel resolves its repository from the calling chat's native metadata and
saved workspace, without sending a message to the agent. When Codex provides a
chat ID before making its workspace available (including an empty new chat),
explain the missing context and show the picker. Recheck five seconds after each
successful check while the picker is visible; failures back off to at most 40
seconds. Pause checks in hidden documents. Retry checks immediately and shows
progress and the time of the completed check. Manual selection wins over an
in-flight lookup and remains selected if workspace metadata appears later. Never
guess from the plugin directory, another panel, or the last-used repository.

Keep registered repositories visible as named choices. Disclose manual path entry
under “Add another repository.” Successful opens remember the canonical repository;
empty lists explain how to add the first entry. Search filters names and paths. A
standalone launcher uses the same registered list, without offering chat actions.
Refresh the list with the same polling policy while choosing, preserving targets
already open. Show “Retry loading map” only after a selected repository fails to
load; an empty selection is not an error. The separate automatic-connection retry
checks only host context.

## Review and verification

Use the [Canvas verification guide](canvas-verification.md) for acceptance checks.

## Implementation owners

`useCanvasDocument` owns drafts, revision conflicts, history and saves;
`RepositoryPicker` owns selection UI. The draft transition module keeps navigation
valid for human and agent commands; Undo restores document history while retaining
current navigation where valid. Shared proposal review compares the captured
basis, binds migration consent to that proposal and applies only to the draft.
MCP proposals and discussion replies share that policy; Save remains explicit.
[MCP integration](mcp-apps.md) owns connection, transport and diagnostic behavior.

## Architecture and agent controls

See the [architecture contract](canvas-architecture.md) for map and editing rules.

## Purpose and initialization

An unsaved repository offers **Initialize architecture**. The button explicitly
asks the owning Codex chat to inspect instructions, relevant files/docs, a bounded
recent commit history and available prior sessions for this repository. The chat
uses that evidence to propose the important and discussed features, with limits
where history is unavailable. Opening a repository alone does not send a modeling
request. Initialization returns a proposal for review, Apply and Save; standalone
preview explains the connected-chat requirement.

## Proposal comparison

See the [proposal comparison contract](canvas-proposal-comparison.md) for the review dialog.

## Interaction inspection

Keep the App info control in the connection popover. It opens the shared
[diagnostics inspector](mcp-apps.md#connection-diagnostics), including in standalone
mode. Closing a discussion request cancels the local request only; an active
Codex turn can continue.
