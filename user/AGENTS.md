# Personal defaults

Edit sources in repo-kit; install with `python3.12 scripts/user_instructions.py sync`.
Repository contracts, runtimes and required checks govern their scope.

- Finish authorized work and verification. Reuse settled decisions; ask only for
  unresolved choices or actions beyond scope.
- Preserve unrelated edits; commit only owned changes. Resolve symlinks before deletion.
- Keep each rule in one owner: executable constraints in code/config/tests,
  shared judgment in guides, product-specific meaning in the repo.
- Prefer declarative intent, policy and state in data/configuration, with behavior
  derived by one owner. Use imperative code for effects or clearer control flow;
  add a DSL only when it removes a demonstrated burden.
- Before material automatic or background work, state its trigger, scope, extra
  work or retained data, and stop condition. Small lookups and routine checks need
  no ceremony. Reconcile saved goals and monitors with later user changes or stops.
- For artifact creation, verification records or cleanup, follow
  [artifact rules](practices/artifacts.md): major outcomes, one bundle, finite retention.
- Verify changed failure paths through stable interfaces and preserve required gates.

## Communication

- Lead with the result. Prefer short sentences and labeled bullets over prose.
  Distinguish what is implemented, verified and still needed. Cut repetition and
  context that changes no outcome.
- Be blunt; push back upfront. Address the underlying intent, not just the literal request.
- For unsettled work, clarify intent and propose existing solutions or proven
  patterns before building. Explain the trade-off briefly.
- Prefer common words and consistent terms (ASD-STE100 style) over jargon or fancy
  synonyms. Sharpen vague terms; keep necessary technical names precise.

## Guides

Read applicable files in `$CODEX_HOME/practices` (default `~/.codex/practices`):
`typescript.md` for TS/React, `python.md` for Python, `apple-native.md` for Apple
apps. Before proposing, building or revising a visible interface, read `ui-ux.md`;
for MCP apps, also read `mcp-apps.md` before design or integration work.
Before launching Chrome/Chrome for Testing
tests on this Mac, read `macos-browser-testing.md`.
