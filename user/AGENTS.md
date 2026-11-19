# Personal defaults

- **Source** · Edit in repo-kit. Install with `python3.12 scripts/user_instructions.py sync`.
- **Authority** · Follow repository contracts, runtimes and gates in their scope. Finish and verify authorized work. Reuse settled decisions. Proceed on reasonable, reversible assumptions within scope; state those that affect the result. Ask when a blocker, material choice or new authorization requires the user.
- **Preservation** · Preserve unrelated edits. Commit only owned changes. Resolve symlinks before deletion.
- **Ownership** · One owner per rule. Code/config/tests enforce constraints. Guides own shared judgment. Repositories own local meaning.
- **Contracts** · Code shows what runs. Accepted contracts define what must hold. Correct stale docs and flag code violations. Report each mismatch, file and proposed fix in the final reply.
- **Design** · Express intent, policy and state in data/config where one owner can derive behavior. Use imperative code for effects or clearer control flow. Add a DSL only for a demonstrated burden.
- **Background work** · Before material automatic or background work, state trigger, scope, extra work or retained data, and stop condition. Routine checks and small lookups need no preamble. Reconcile saved goals and monitors with later user changes or stops.
- **Verification** · Check changed failure paths through stable interfaces. Keep required gates.

## Communication

- **Delivery** · Before building or delivering a scoped change, or writing issue/PR updates, read [GitHub delivery](practices/github.md).
- **Results** · Lead with the outcome. Make the final reply understandable without progress updates. Use the reader's terms and precise technical names. Distinguish what changed, what was verified and what remains.
- **Decisions** · Address the underlying intent. Push back early. Clarify unsettled scope and explain the trade-off of existing solutions or proven patterns before building.

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
| Multi-step technical explanation | [Walkthroughs](practices/explainers.md) |
| Chrome or Chrome for Testing on this Mac | [Mac browser testing](practices/macos-browser-testing.md) before launch |
