# Repo Canvas interaction redesign — review proposal

Status: annotated design prototype, not shipped behavior. Prepared 2026-10-21 from the supplied screenshot, current source at 435c554, and local browser inspection. The existing saved architecture and product source are unchanged.

## Governing rule

One visible owner per fact. Orientation, explanation, review and editing are separate states. A detail moves from a transient peek into a pinned panel; it is never mirrored in both. Editing replaces reading for the same field. A locator may repeat a name when its original object is outside the visible canvas. The parent-only scope navigator may repeat identity labels as destinations, but never duplicates their descriptions or metadata.

## Surface responsibilities

- Canvas: identity, semantic type, selected short fields, navigation and a single annotation badge. No truncated responsibility paragraphs, source-path wallpaper or duplicate note counts.
- Peek: additional explanation, bounded relationship evidence, or note contents. Hover and keyboard focus share behavior; Escape dismisses. Click pins the same content and removes the peek. Hover must be dismissible, hoverable and persistent while the pointer/focus remains inside it.
- Detail panel: selected subject context, readable field groups, relevant sources and explicit Edit. Suppress its object's hover. Notes and source actions can open directly from the canvas. The current scope and selection are distinct.
- Chat: one current exchange and composer; previous exchanges collapsed. Context is a removable attachment, frozen for each sent request. Scope changes cannot relabel old responses. Delivery errors retain the unsent text and never auto-resend.
- Source workspace: file/range, line numbers, syntax highlighting, surrounding context and file status. Edit the selected block, review a diff, then save that file explicitly. Map draft and repository file writes are independent.
- Type definitions: repository-owned declarative field schemas and card/peek/detail projections. No executable code. Agents propose schema plus data in the normal proposal workflow. Type-edit previews validate missing fields, duplicate placement and unknown types.

## Source edit contract

References support path plus one-based start/end lines; whole-file references remain valid. A live read returns a content revision and actual line bounds. Out-of-range anchors are shown as unresolved, never silently clamped. Diff review binds the exact baseline revision, range and replacement. A stale file blocks Save; re-read and review again. Validate repository containment and file identity server-side, including symlink escapes, protected paths, binary/oversized files and concurrent changes. Do not add a generic shell or arbitrary filesystem API. Saving source does not auto-save the map or claim the architecture is still accurate.

## Declarative types

Built-ins explain their semantic role. Repository-local types refine a base kind and define text, number, boolean, enum and source-reference fields. A field has one primary surface: card, peek or details. Pinning promotes peek fields; detail-only fields then become available. Editing uses the same schema. Unknown types retain raw values and show a clear fallback. Proposed schema changes show affected nodes and compatibility/migration impact before Apply. Accepted types live in the saved architecture document so agent/UI round trips preserve them. A future schema version must prevent old clients silently dropping new fields.

## Responsive and interaction rules

No automatic overview shrinking when a panel opens. Preserve the camera and selected node; if context cannot fit, show the pinned detail first and keep the readable map below it. On narrow screens use a compact node list/flow and a dedicated detail/source surface rather than unreadably scaling the graph. Touch taps pin; keyboard focus exposes the same peeks. Keep provenance and unsaved/conflict status adjacent to the action they qualify.

## Evidence and limits

Observed: duplicate card/hover/editor content; source preview is plain whole-file text; relationship reading opens an edit dialog; notes sit below sources and relationship forms. Captured desktop and narrow inspector, source modal and relationship dialog under evidence/. Historical chat folding is grounded in SideChat.tsx, which renders every message inline; the standalone preview cannot reproduce the hosted mailbox. This prototype demonstrates local state only: no model calls, repository writes, executable type extensions or production migrations.

## Implementation boundaries for the later product pass

1. Reading surfaces: Canvas, Inspector, RelationshipDialog and SideChat; retain revision/proposal handling.
2. Source reference and editing boundary: document schema, typed operation catalogue, repository read/write service, focused editor UI and conflict tests.
3. Declarative types: schema validation, view projection, structured definition editor, agent proposal compatibility and saved-map migration tests.
4. Acceptance: desktop/compact/touch, keyboard focus and Escape, hover transfer, source stale-write refusal, schema round trip, chat delivery recovery, Apply versus Save separation. Existing package and browser gates remain required.


## Review iteration 2 — contextual authoring and groups

- Remove the permanent Map actions button. Blank-canvas context menu owns Add node, group creation, Undo, Export, Import and Reload. Node, relationship and note context menus expose only their own actions. Right-click, Shift+F10/context-menu key and a small touch-accessible overflow affordance share the same menu.
- Navigation is an explicit element. Show parent modules by default, with an optional Show leaves control. Creating a leaf's first child preserves the leaf's ID and position, changes its corner + to a child-count action, and makes it appear in navigation. Navigation changes scope; clicking a card changes selection.
- A group is a named, described collection of existing node references in a scope. It is not a node, parent, source owner or edge endpoint. Groups can overlap. A lane is an optional presentation of the same primitive. Group removal never removes or reparents member nodes.
- The compact focus selector defaults to All; group selection dims nonmembers and unrelated edges. Hide is optional and masks them in place without reflow. Returning to All restores the original layout. Filtering is view state, not a map mutation; editing group membership is a draft change.
- Notes have attention presets: risk/red, warning/yellow, info/neutral white. Always retain textual labels. Decision/question intent is separate metadata and is preserved when severity changes. Notes are editable and removable; removal exposes Undo.
- Contextual agent comments are instructions, not automatically permanent map notes. A node/link/note comment captures target kind and stable ID, owner where applicable, object content, source references, scope and base map revision. Queue multiple comments and review the handoff before explicitly sending through the owning chat. Selection changes cannot retarget a captured comment.
- The HTML prototype supports the context menus, note edit/remove/undo, leaf-to-parent transition, group creation/filtering and frozen comment packets locally. It does not send a host message: Review handoff provides Copy request and Export request for a deliberate main-chat handoff. Production delivery must retain the queue on failure and never auto-retry uncertain sends.
