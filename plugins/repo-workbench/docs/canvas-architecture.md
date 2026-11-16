# Repo Canvas architecture and agent controls

This contract owns map semantics, editing safety, and agent controls. See the
[Canvas design](canvas-design.md) for the main journey.

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
