# Repo Canvas proposal comparison

This contract owns the review dialog in the [Canvas journey](canvas-design.md)
and links to the [verification checks](canvas-verification.md).

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
and title. Separate meaning (names, labels and values), structure (parents and
endpoints), evidence (source references), and position (node coordinates). Do not
infer renames or runtime impact. An overview line can represent multiple original
relationships; each retains its ID. Selecting a change reveals exact before/after
values and the owning scope; missing entities or scopes are explicit. Preserve
authored coordinates and use readable zoom and pan. Changes highlights one valid
snapshot at a time. Removed items use the baseline view.

Reordering entity collections, source references or group members does not show
as a change. The order of field definitions can affect display. Exact-basis
conflict checks remain separate from the display comparison.

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

## Deferred integration

A future integration could reuse this comparison for the graphics in
`improve-codebase-architecture`: current versus proposed structure, affected
files, problem, solution, locality/leverage/testability benefits, recommendation
strength and any ADR conflict. Keep this independent of executing a refactor or
reopening accepted decisions.
