# Repo Canvas design: Little Clarity adaptation

This contract applies to Repo Workbench’s `packages/repo-canvas`. The main path is **view architecture → inspect
source → discuss → review a proposal → apply and save**.

The map is a simplified but faithful architecture and feature-design view for
onboarding and design discussion. Show core concepts, use cases and data flow.
Prefer a small overview and selected nested concepts; supporting files and
artifacts belong in source references, not separate nodes.

This contract owns the accepted reading, contextual authoring and grouping
decisions. [Review notes](../../../docs/reviews/README.md) retain the brief rationale.

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
  file. File saves and map saves are independent; changed range bounds update the draft.
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

Capture the actual delivered UI before editing and compare matched states after:
1440×1000 desktop, 740×950 compact host, and 390×844 mobile. Use the same saved
architecture, root selection and 80% diagram zoom for comparisons. Keep original
full screenshots and annotate only report crops. Label simulated MCP hosts.

Check the main journey, source preview/editing, proposal review, real stale edits,
keyboard menu access, export/import, Undo, Reload and panel close/reopen. Verify
normal text contrast at 4.5:1 and meaningful focus/control contrast at 3:1. Retain
reduced-motion support. Dark appearance is the existing supported scope; this
adaptation does not add or claim verification of a light theme.

Run the normal repository gate and the Repo Canvas browser suite. Report actual
Codex host integration separately from protocol and simulated-host browser tests.

## Implementation owners

`useCanvasDocument` owns drafts, revision conflicts, history and saves;
`RepositoryPicker` owns selection UI. The draft transition module keeps navigation
valid for human and agent commands; Undo restores document history while retaining
current navigation where valid. Shared proposal review compares the captured
basis, binds migration consent to that proposal and applies only to the draft.
MCP proposals and discussion replies share that policy; Save remains explicit.
[MCP integration](mcp-apps.md) owns connection, transport and diagnostic behavior.

## Architecture and agent controls

A folder scaffold is incomplete discovery, not a semantic claim. Discover breadth
first and disclose truncation so a large early subtree cannot hide root owners.
A curated map should show responsibilities, source references, meaningful verbs,
and boundaries. Keep detail inside scopes; avoid making a card for every file.

The only supported document format is **v3**. There is no automatic legacy import
or migration layer. Invalid or older files retain their bytes; show offline agent
repair guidance and Start new draft. Starting a draft never writes the saved map.
An explicit Save still compares the raw disk revision before replacing it.

Built-in node kinds identify systems, packages, modules, data, external owners,
processes, interfaces and concepts. Repository-owned `nodeTypes` declare named
fields (`text`, `number`, `boolean`, `enum`, `source`) and one primary surface
(`card`, `peek`, `details`). Peek fields move to Details when pinned; card fields
are not repeated there. No executable renderers. Preserve unknown types/fields as
readable fallback data. Review affected nodes before deleting fields or changing
value types; explicit migration acceptance is required before removing values.
Agent proposals include the same migration review.

Connections retain precise verbs, optional kind, explanation and source references.
Saved annotations target `{kind:"node"|"connection",id}` and record severity and
intent separately. Contextual comments may also target annotations. Capture the
object, scope, source references and document hash when the comment is authored;
keep that snapshot even if the live target changes. Comments queue for explicit
Send to chat; they do not become saved map notes.

Discussion drafts, frozen comments and up to 100 exchanges live outside Git in
`$XDG_STATE_HOME/repo-workbench/discussions` (default `~/.local/state`). Partition
by canonical repository and trusted host chat ID; standalone has its own namespace.
Use private files, atomic writes and revision checks. Keep earlier exchanges folded;
focus on the latest query. Preserve uncertain sends and never automatically resend.
History is cleared only explicitly, after closing pending requests. Map recovery
remains browser-tab/server-context state, separate from durable discussion state.

Source writes are limited to explicitly referenced, existing Git-visible UTF-8
files under 500 KB, blocks under 40,000 characters, without symlink components or
hardlinks. No creation, deletion, rename, binary editing or whole-repository IDE.
Compare the full-file content revision immediately before atomic replacement;
retain surrounding lines, file mode and newline style. Reload and review again
on conflict; never overwrite an external edit automatically.

Fit centers complete card bounds inside the drawing pane with reserved control
space. It is an overview, not a promise that all text stays readable. Offer 100%
reading, Fit selection and undoable Arrange for the pane’s aspect ratio. Preserve
manual pan/zoom on resize; refit changed node sets before paint. Auto-collapse
navigation below 1100px and keep Browse/Close usable at every width. Dense maps
show edge labels on selection or focus; vertical edges join the nearest faces.

Select several and modifier-click support explicit sets without requiring a
pointer gesture. Side chat includes all selected IDs and names. Native gestures,
keyboard focus, compact navigation, stale proposals and save conflicts must work.

MCP exposes semantic snapshots, exact-revision view commands and reviewed proposals.
Snapshots name their timestamp and freshness, selected IDs, scope, viewport,
panels, dirty/conflict state, visible nodes and command receipts. A command is
queued until the panel acknowledges it; read the resulting snapshot to verify it.
Retry interrupted acknowledgments without executing a view command again. Commands
apply to their original scope and must not replay when navigating elsewhere.
View commands never save. Proposals compare the captured document before Apply;
Save remains a separate user action. Browser tools own DOM and screenshot evidence,
including transient dialogs; arbitrary JavaScript execution is not part of this SDK.

Named multi-view maps, lasso selection and freeform highlight regions are deferred.
The current evidence supports typed graph semantics and attached review notes;
more drawing primitives should follow concrete workflows, not mimic a whiteboard.

## Purpose and initialization

An unsaved repository offers **Initialize architecture**. The button explicitly
asks the owning Codex chat to inspect instructions, relevant files/docs, a bounded
recent commit history and available prior sessions for this repository. The chat
uses that evidence to propose the important and discussed features, with limits
where history is unavailable. Opening a repository alone does not send a modeling
request. Initialization returns a proposal for review, Apply and Save; standalone
preview explains the connected-chat requirement.

Deferred proposal comparison may replace the graphics in
`improve-codebase-architecture`: current versus proposed structure, affected
files, problem, solution, locality/leverage/testability benefits, recommendation
strength and any ADR conflict. Keep this independent of executing a refactor or
reopening accepted decisions.

## Proposal comparison

Repo Canvas is a discussion board. The architecture document is the common model
for agent edits and human feedback; it is not only a presentation artifact.
Keep model validity, authored changes and human intent separately inspectable.

Both proposal origins use one **Review changes** entry in the existing proposal.
Open a read-only dialog with one Before / Changes / After selector, a change list
and one map. Before is always the captured proposal basis. A stale proposal remains
inspectable, with Apply disabled in its existing owner. Close returns focus to the
trigger; review browsing does not alter draft selection, navigation or history.
Apply to draft and Save retain their current owners outside the comparison.

Compute changes from original stable identities across the whole document,
including nested nodes, precise relationships, annotations, groups, type definitions
and title. Separate meaning, structure, evidence and position. Do not infer renames
or runtime impact. Projected overview lines retain their underlying relationship
IDs. Selecting a change reveals exact before/after values and its owning scope;
an absent entity/scope is explicit. Preserve authored coordinates and use readable
zoom/pan. Changes is a highlighted view of one valid snapshot at a time, never an
invented merged document. Removed items use the baseline view.

Keep the originating question and frozen human comments available in comparison
when attached to the proposal. Show their captured revision and targets; they are
intent for the agent, not new map annotations or a second comment editor. Raw
JSON remains available for detail. Compact hosts stack the list and map without
adding duplicate navigation or hiding review controls.

Text must remain readable under discussion: place inline relationship labels only
where their conservative bounds avoid cards and other labels. Full names remain
in accessible link controls and relationship inspection when an inline label cannot
fit. The renderer clips and ellipsizes text within those bounds, including wide
Unicode glyphs. Hover details render at screen scale and stay within the drawing pane; they
close when selecting. Dense maps disclose labels on selection/focus.

## Interaction inspection

Keep the existing connection popover and map/chat layout. Its App info control
also opens tool contracts, conversation fixtures and interaction inspection.
The same inspection is available in standalone mode. App SDK/HTTP observations
and server wire observations retain separate identities; they do not invent host
processing or model responses. Metadata is persisted by default. Saving payloads
requires an explicit capture of one selected interaction. Closing a discussion
request cancels the local request only; it cannot cancel an active Codex turn.
