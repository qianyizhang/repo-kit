# Repo Canvas proposal comparison

- **Goal** · Inspect what a proposal changes and the captured human intent before applying it. [Canvas design](canvas-design.md)
- **Outcome** · One **Review changes** dialog for MCP proposals and discussion replies. Before / Changes / After, one change list and one map. Read-only until Apply outside the dialog.

| Contract        | Acceptance                                                                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basis           | Before uses the captured document. Stale proposals remain inspectable with Apply disabled. Close restores trigger focus. Review preserves draft selection, navigation and history.                                                                              |
| Identity        | Compare stable identities across the full document, including nested nodes, original connections, annotations, groups, type definitions and title. Overview links preserve original relationship IDs.                                                           |
| Change kinds    | Meaning (names, labels, values), structure (parents, endpoints), evidence (sources) and positions. Changes show exact values and owning scope. Missing entities/scopes are explicit. Remove shows the baseline.                                                 |
| Ordering        | Reordered entities, sources or members produce no display change. Field-definition order can affect presentation. Exact-basis conflicts are checked separately.                                                                                                 |
| Layout          | One valid snapshot at a time, authored positions, readable pan and zoom. Narrow views stack the list and map with the same review controls.                                                                                                                     |
| Captured intent | Preserve the originating question and frozen comments with their target and revision. Raw JSON available for detail. Map notes and comment resolution have separate owners.                                                                                     |
| Labels          | Inline only when conservative bounds clear cards and other labels. Clip/ellipsize wide text. Full names in accessible link controls and inspection. Screen-scale hover stays inside the pane and closes on selection. Dense labels disclose on selection/focus. |

- **Evidence limit** · Identity changes show additions/removals. Runtime impact needs source evidence.
- **Verification** · [Canvas checks](canvas-verification.md)

## Deferred integration

- **Candidate** · Reuse comparison graphics for `improve-codebase-architecture`: current/proposed structure, affected files, problem, solution, locality/leverage/testability, recommendation strength and ADR conflicts.
- **Boundary** · Review only. Refactor execution and reopening decisions require separate intent.
