# Authoring an architecture document

Repo Canvas is a discussion board. Agents and humans work through a shared
architecture document: source-backed meaning, a readable map and contextual
feedback. Archify calls its renderer inputs IR (intermediate representation).
Our durable model remains `Architecture` v3; the comparison is a derived view.
Tool input schemas and the document parser enforce validity. This guide explains
meaning and revision discipline, rather than duplicating their constraints.

## Choose the right primitive

| Primitive            | Meaning                                                                     | Authoring decision                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module/node          | A named responsibility or concept with one parent scope.                    | Use the existing kind and repository vocabulary. A directory is evidence, not automatically a responsibility.                                                               |
| Connection           | A directed, named relationship between exact nodes.                         | State the action and its conditions. Distinguish dependency, data flow, control flow, evidence and ownership. Cite the actual caller/writer when claiming execution or I/O. |
| Node type and fields | Repository-defined vocabulary and inspectable properties.                   | Reuse definitions. Keep meaning stable; field removal or value-type changes need the existing migration review.                                                             |
| Group                | A named set of sibling nodes within a scope; membership may overlap.        | Use it for focus. Membership alone does not establish a security or execution boundary.                                                                                     |
| Annotation           | A durable note, question or decision attached to a node or connection.      | Keep intent separate from severity. Preserve human-authored notes unless the requested change resolves or revises them explicitly.                                          |
| Source reference     | A repository path, optionally with an inclusive line range.                 | Attach evidence to the claim it supports, including relationships. A valid path does not prove the claim.                                                                   |
| Contextual comment   | Human instruction frozen with target, scope, revision and captured content. | Read the frozen target before interpreting intent. It is not a mutable map annotation.                                                                                      |

Stable IDs carry identity across revisions. Changing a name retains its ID;
splitting, merging or replacing a concept needs an explicit explanation. Never
reuse an old ID for an unrelated role. The comparison treats different IDs as
addition/removal rather than guessing a rename.

## Revise from a captured request

1. Read the submitted message; use `canvas_map` for its frozen document and
   `canvas_comments`/`canvas_comment_text` when needed for
   comments. Separate requested outcomes from incidental labels in the capture.
2. Read the current snapshot when needed. If the target changed since capture,
   identify the difference before proposing a revision. A missing target is an
   unresolved reference, not permission to transfer the instruction by name.
3. Trace the relevant source slice through input, operation and output. Preserve
   unknowns. Put approval or state conditions on the affected relationship or
   node; a detached note cannot qualify an unconditional arrow.
4. Revise the smallest connected scope that satisfies the request. Preserve
   unrelated identities, sources, notes, groups, type definitions and positions.
   If layout needs repair, change placement without silently deleting meaning.
5. Check the complete document with the available parser/tool validation. Repair
   the reported subject before retrying. Do not remove evidence or human intent
   to make an invalid proposal pass. A schema pass establishes structure only.
6. Return the complete proposal through the request's reply route, explaining
   how it addresses each material comment and what remains open. A new standalone
   proposal uses `canvas_propose` with the current snapshot revision.

Do not write the saved map as a substitute for proposal review. Apply changes the
draft; Save is explicit. Comparison does not mark a comment resolved. An accepted
decision remains owned by the repository's existing design/decision record.

## Check the proposed change

**Review changes** shows the captured baseline, authored changes and proposal.
The change list covers all scopes, notes, groups and types, including facts with
no independent shape. It distinguishes:

- meaning: names, responsibilities, labels, custom values and definitions;
- structure: parents, connection endpoints, group membership and note targets;
- evidence: source references;
- position: node coordinates.

Reordered entity collections do not imply a change; ordered field definitions
can affect display. Source-reference and group-membership order are ignored by
the display comparison. Exact-basis conflict checks remain separate.

An overview line can represent multiple original connections. Inspect their
exact IDs; a projected line is not a new relationship. For a removed item the
Changes view uses the baseline. Selecting an absent item in After reports its
absence. Before never silently becomes the current draft when a proposal is stale.

Review for preserved intent, accurate source claims, readable relationships and
unexpected changes. Authored reachability and diagram differences do not establish
runtime impact, correctness of a refactor or merge safety.

Adapted concepts: Archify `25cf37080fc8b1dbe758a4efc3935b55f3327083`,
`references/repository-authoring.md`, `references/authoring-defaults.md` and
`delta/architecture-delta.mjs`. Our primitives, transport and feedback ownership
remain local. See repo-kit's `docs/reviews/README.md` for the review.
