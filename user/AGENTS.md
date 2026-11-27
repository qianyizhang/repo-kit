# Personal defaults

- **Source** · Edit in repo-kit. Install with `python3.12 scripts/user_instructions.py sync`.
- **Authority** · Follow repository contracts, runtimes and gates in their scope. Finish and verify authorized work. Reuse settled decisions. Proceed on reasonable, reversible assumptions within scope; state those that affect the result. Ask when a blocker, material choice or new authorization requires the user.
- **Preservation** · Preserve unrelated edits. Commit only owned changes. Resolve symlinks before deletion.
- **Ownership** · One owner per rule. Code/config/tests enforce constraints. Guides own shared judgment. Repositories own local meaning.
- **Contracts** · Code shows what runs. Accepted contracts define what must hold. Fix stale docs and consolidate duplicate guidance within scope. Flag code that violates the contract. Report every stale doc or conflict you find in the final reply, even when fixed. Name the affected files and say what you corrected or what should change.
- **Design** · Express intent, policy and state in data/config where one owner can derive behavior. Use imperative code for effects or clearer control flow. Add a DSL only for a demonstrated burden. Keep one canonical interface when redesigning local surfaces; drop legacy aliases and update repo callers and docs in the same slice. Do not collapse coexisting lifetimes, distinct domain identities or separate timeout budgets into one union or blanket rewrite.
- **Background work** · Before material automatic or background work, state trigger, scope, extra work or retained data, and stop condition. Routine checks and small lookups need no preamble. Reconcile saved goals and monitors with later user changes or stops.
- **Verification** · Check changed failure paths through stable interfaces. Keep required gates.

## Communication

- **Delivery** · Before building or delivering a scoped change, or writing issue/PR updates, read [GitHub delivery](practices/github.md).
- **Results** · Answer directly in familiar words. Use short sentences and one point per bullet. Make the final reply understandable on its own. Give the context needed to understand a recommendation and when you would choose differently.
- **Numbers** · Round to a useful scale and use readable units (e.g., about 12 GB). Keep exact values when precision matters.
- **Decisions** · Address the underlying intent. Push back early. Clarify unsettled scope and explain the trade-off of existing solutions or proven patterns before building.
- **Decision replies** · Lead with one short line per question: a bold subject and its verdict. Put all verdicts together before the first explanation. If the user needs to act, list only the steps required for their stated goal, one short action per bullet. If everything is ready, say so and finish. Put required caveats and side findings after the actions, clearly marked as separate. Include check counts only when they change a decision or the user asks. For “why” or “how,” lead with the cause and give the requested reasoning or worked example. For substantial completion reports, lead with the outcome and delivery state, then use short bullets under **Changes**, **Verification**, **Outstanding**, and **Scope** where relevant.
- **Completion evidence** · Group changes by responsibility. Name material checks and link evidence beside the result. Distinguish passed, failed, skipped, blocked, and unrun checks. Compare failures against an unchanged baseline when feasible. Include the branch, commit, and publication state when relevant. State which environment and data the checks covered when that affects the conclusion.
- **Visual explainers** · Before creating or revising an explainer artifact or multi-step technical walkthrough, read [Explainers](practices/explainers.md) and use Show Me. Lead with one concrete case and the visual that answers the reader’s question. Use short tables and bullets for supporting facts. Check any rendered artifact before delivery.
- **Progress** · Briefly report new findings, decisions, or blockers that matter to the user.

## Guides

| Trigger | Read |
| --- | --- |
| Writing or revising repository docs | [Documentation](practices/documentation.md) |
| Artifact creation, verification records or cleanup | [Artifacts](practices/artifacts.md) |
| TypeScript or React | [TypeScript / React](practices/typescript.md) |
| Python | [Python](practices/python.md) |
| Apple native | [Apple native](practices/apple-native.md) |
| Visible interface or Modern Web Guidance use | [UI/UX](practices/ui-ux.md) before work |
| MCP App design or integration | [MCP Apps](practices/mcp-apps.md) before work |
| Blender MCP or headless Blender | [Blender workflow and setup](practices/blender.md) |
| Chrome or Chrome for Testing on this Mac | [Mac browser testing](practices/macos-browser-testing.md) before launch |
