# Review outcomes

Condensed on 24 October 2026. These are historical decisions and limits, not
current verification results. Current source and contracts own behavior. Completed
maps, captures, test logs and per-file hash receipts have been removed.

## Product outcomes

- **Canvas:** the 21 October review established reading/editing modes, one owner
  per fact, contextual notes and focus on the current question. Accepted meaning
  lives in [Canvas design](../../plugins/repo-workbench/docs/canvas-design.md).
- **Example MCP App:** `43a08a4` implemented one scenario navigation, four actor
  lanes, ordered observed events and one observation store for inspection/export.
  [Design](../../plugins/example-mcp-app/design.md) and
  [verification](../../plugins/example-mcp-app/README.md#verification) own the result.
  SDK-fixture checks did not establish native conversation delivery. Native v0.3
  acceptance was later recorded on 23 October at build `e0dbe92d7284`; it does
  not cover the later observability build.
- **Workbench ownership:** the 23–24 October review led to separate user/background
  retention, caller-scoped contexts, crash-recoverable discussion transactions,
  nested trace validation, shared host lifetimes, ReportSession and Example CI.
  [Runtime contract](../../plugins/mcp-app-runtime/README.md) owns immutable
  identity/policy, command-driven state and new lifetimes on reconnect; product
  owners recover drafts. Source/package/browser checks were reported passing.
  [Migration acceptance](../migrations/repo-workbench.md) retains unfinished native
  checks; installed cross-chat process sharing was not established.
- **Open review candidates:** recheck usage-to-trace scroll restoration, result
  schemas for tool catalogs, cross-process diagnostic correlation and full
  keyboard/accessibility coverage before claiming them complete. Measure cold
  panel load, idle traffic and large-history memory before adding budgets or
  splitting bundles. These are follow-ups, not new implementation authorization.

## Guidance outcomes and attribution

- **Report UI, 27 October:** the Saul/EZ round established component/region/leaf,
  peer-level and context-view terms, plus contextual inspection and guided visual
  comparisons. The [review-surface contract](../../skills/ui-discussion/references/review-surface.md)
  owns their definitions and rules; the template and validator own behavior and
  gates. The report presentation was accepted; application UX decisions remain
  open. Native captures and HTML proposals were kept distinct.

- **Interfaces, 26 October:** adapted concrete hover/focus, contrast-role,
  field-error and reflow checks from [Jakub Krehel's Interfaces skills](https://github.com/jakubkrehel/skills/tree/592aedc44d7d5b3e29740984252902f3e5402a1c)
  (MIT, version 1.17.0) into the existing UI/UX guide. UI discussion owns evidence
  reporting; finish-work owns change classification. Two synthetic browser trials
  reproduced Workbench tooltip and input-boundary defects; a committed-source
  Saul review identified an unverified field-error improvement candidate. These
  same-agent trials do not establish a quality advantage or accessibility
  conformance. Exact aesthetic recipes, blanket severity and a second review
  framework were not adopted. No upstream skill files were imported.
- **Finish-work, 14 October:** a small synthetic comparison found both the normal
  prompt and the skill fixed the same state-reset defect. The skill made candidate
  and regression checks more explicit; a repeat produced no edits. No general
  quality, latency or cost advantage was measured. [The skill](../../skills/finish-work/SKILL.md)
  owns the procedure; private session registers are no longer duplicated here.
- **UI discussion, 22 October:** map the actual layout and name components before
  tracing journeys. A generic prototype did not establish shared understanding.
  Feedback from the Example sequence design informed the
  [UI/UX](../../user/practices/ui-ux.md) and [MCP](../../user/practices/mcp-apps.md)
  guides. [UI discussion](../../skills/ui-discussion/SKILL.md) owns review mechanics.
- **Practice library, 22 October:** clean local sources included TB3 `8044b9ac`,
  game `f3e353d`, Saul `1c1645f` and repo-kit `e994319`. Portable judgment was adapted
  from [Lauren Tan's pstack](https://github.com/cursor/plugins/tree/d1453c11d1dde9714d4c313c97d3a68432265c7f/pstack)
  (MIT, `d1453c11`); host orchestration was not adopted. Topic guides retain primary
  references. Matt Pocock upstream selection and license remain in
  [the skill lock](../../skills-lock.json) and [license](../../skills/mattpocock-LICENSE).
  This was synthesis and manual review, not proof of agent compliance.
- **MCP practice:** source review used repo-kit `96221a6`, Astro `e100f85` and Saul
  `feee3da`: shared operations across HTTP/MCP, frozen selections, explicit Apply
  and Save, and no retry of uncertain effects. The independently generated starter
  has its own behavior gates; it is not automatically synchronized with plugins.
- **Archify, 23 October:** adapted stable diagnostics/readiness and meaning-versus-
  geometry comparison from [tt-a1i/archify](https://github.com/tt-a1i/archify/tree/25cf37080fc8b1dbe758a4efc3935b55f3327083)
  (MIT, `25cf3708`). Local models remain authoritative. Accepted one read-only
  proposal comparison with frozen feedback and declared coverage gaps; deferred
  extra diagram modes, motion and committed-source-only provenance. Owners are
  [Canvas authoring](../../plugins/repo-workbench/docs/canvas-authoring.md) and
  [review readiness](../../skills/ui-discussion/references/review-surface.md).
