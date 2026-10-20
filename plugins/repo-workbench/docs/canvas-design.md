# Repo Canvas design: Little Clarity adaptation

This contract applies to Repo Workbench’s `packages/repo-canvas`. The main path is **view architecture → inspect
source → discuss → review a proposal → apply and save**.

The map is a simplified but faithful architecture and feature-design view for
onboarding and design discussion. Show core concepts, use cases and data flow.
Prefer a small overview and selected nested concepts; supporting files and
artifacts belong in source references, not separate nodes.

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
implementation and dark appearance. No sibling checkout, token generator, new
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

Use the upstream serif subject role for the current scope heading, at 22 px on
wide screens and 20 px in compact layouts. Navigation, module names and controls
stay system sans. Compact architecture controls use 13 px; captions use 12 px;
chat answers use the upstream 15 px reading size and 1.65 line height. These are
intentional density adaptations from the upstream 24/15/14/12 px scale. Canvas
zoom still scales the diagram; preserve zoom and Fit view controls.

## Hierarchy and disclosure

- Keep checkout path, host mode and saved/draft state in the header at every width.
  A hosted iframe is not proof of a real Codex connection. Use `MCP host session`
  or `Standalone preview`; do not infer liveness from decorative indicators.
- Give Inspect and Side chat direct toolbar access. Save remains in the header.
  Apply remains beside its reviewed proposal and never silently writes the map.
- Group module creation, Undo, Export, Import and Reload under **Map actions**.
  Use native disclosure semantics, keyboard activation and Escape-to-close with
  focus returned to the summary. Keep each action's existing safety behavior.
- Show source references directly. Put path editing under **Edit source paths**.
  Suggested questions and storage explanation are optional disclosures.
- Remove repeated branding, ornamental module numbers and repeated network labels.
  Use spacing and type hierarchy rather than nested decorative cards.
- At narrow widths, stack the active inspector/chat below the architecture. It must
  not cover navigation, Save or the canvas controls. Give each panel an explicit
  close action. Preserve text wrapping and visible state; avoid horizontal overflow.

## Repository selection

A new panel with no repository is a normal launch state. Show “Connecting to this
chat’s repository…” while one message to the owning chat resolves a single-use
binding. Explicit tool targets open directly. Manual selection cancels any pending
binding; late answers cannot replace the selected repository. Do not guess a target
from the plugin process directory or another panel's most recent repository.

Show an accessible status with a reduced-motion-aware spinner while awaiting the chat. A live panel renews its 30-minute request lease, and missing message acknowledgment does not cancel delivery or trigger another message.

Keep registered repositories visible as named choices. Disclose manual path entry
under “Add another repository.” Successful opens remember the canonical repository; empty lists explain how to add the first entry. Search filters names and paths. A standalone launcher uses the same registered list,
without offering chat actions. Refresh the list while choosing, preserving targets
already open. Show “Retry loading map” only after a selected repository fails to
load; an empty selection is not an error and has no Retry button.

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

## Architecture and agent controls

A folder scaffold is incomplete discovery, not a semantic claim. Discover breadth
first and disclose truncation so a large early subtree cannot hide root owners.
A curated map should show responsibilities, source references, meaningful verbs,
and boundaries. Keep detail inside scopes; avoid making a card for every file.

Use typed nodes for systems, packages, modules, data, external systems, processes,
interfaces and concepts. Connections have a precise label plus an optional type
(dependency, data flow, control flow, evidence or ownership), explanation and source
paths. Review notes distinguish notes, questions, risks and decisions. Keep actor
attribution explicit. These additions use document version 2; existing version-1
maps remain readable and unchanged until extended fields are used. Older clients
must reject version 2 rather than silently erase its meaning.

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

Text must remain readable under discussion: place inline relationship labels only
where their conservative bounds avoid cards and other labels. Full names remain
in accessible link controls and relationship inspection when an inline label cannot
fit. The renderer clips and ellipsizes text within those bounds, including wide
Unicode glyphs. Hover details render at screen scale and stay within the drawing pane; they
close when selecting. Dense maps disclose labels on selection/focus.
