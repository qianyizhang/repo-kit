# Authoring an architecture document

- **Goal** · A readable, source-backed architecture map that addresses captured feedback.
- **Durable model** · `Architecture` v3. The comparison derives views from the document. Tool schemas and the parser enforce structure.

## Choose the right primitive

| Primitive            | Authoring outcome                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module/node          | Named responsibility or concept in one parent scope. Use repository vocabulary and cite the relevant source.                                                                     |
| Connection           | Directed relationship with a precise verb and conditions. Distinguish dependency, data/control flow, evidence and ownership. Cite the caller or writer for execution/I/O claims. |
| Node type and fields | Stable repository vocabulary and inspectable properties. Field removal or value-type changes require migration review.                                                           |
| Group                | Named, possibly overlapping sibling set for focus. Execution and security boundaries need separate evidence.                                                                     |
| Annotation           | Durable note, question or decision attached to a node or connection. Keep intent and severity distinct.                                                                          |
| Source reference     | Path and optional inclusive range attached to the supported claim, including claims on links.                                                                                    |
| Contextual comment   | Frozen human instruction with a target, scope, revision and captured content.                                                                                                    |

- **Identity** · Keep IDs for renamed entities. Explain splits, merges and replacements. Reserve an existing ID for the same role.

## Revise from a captured request

| Acceptance      | Evidence                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Intent resolved | Frozen basis from `canvas_map`, with `canvas_comments` or `canvas_comment_text` as needed. State target drift or an unresolved target before proposing.                                          |
| Claims grounded | Relevant input, operation and output traced. Conditions on the affected relationship or node. Unknowns visible.                                                                                  |
| Edit bounded    | Smallest connected scope. Unrelated IDs, references, notes, groups, types and positions preserved. Layout changes preserve meaning.                                                              |
| Proposal valid  | Complete document passes parser/tool validation. Repair the failing subject while preserving evidence and human intent.                                                                          |
| Review ready    | Reply through the request's route with the complete proposal, disposition of material comments and open questions. For a fresh proposal use `canvas_propose` with the current snapshot revision. |

## Check the proposed change

- **Review outcome** · Preserved intent, accurate source claims, readable relationships and expected changes against the captured basis. [Review changes](canvas-proposal-comparison.md)
- **Write boundary** · Apply changes the draft. Save is explicit. Comparison leaves comments open. Settled decisions belong in the repository's existing record.
- **Evidence limit** · Schema validity proves structure. Authored reachability and diagram deltas alone cannot establish runtime impact, refactor correctness or merge safety.
- **Attribution** · Archify `25cf37080fc8b1dbe758a4efc3935b55f3327083`, `references/repository-authoring.md`, `references/authoring-defaults.md` and `delta/architecture-delta.mjs`. Repo-kit's review record links the adopted scope and source.
