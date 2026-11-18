# Repo-kit backlog

- **Completed locally** · Canvas source-save reconciliation, portable work-item rules, frozen evidence and shared diagnostics.
- **Original findings** · `e621979:docs/fixes.md`

## Deferred work

| Area | Revisit when | Outcome |
| --- | --- | --- |
| Trace parsing and ownership (C, B) | Another recorded wrapper needs a parser change | One analysis per wrapper. Equivalent fixture results. Move contracts only where this removes reverse imports. |
| Discussion writes (G) | Measured typing bursts show write or latency cost | Keep the latest waiting draft. Send and Clear flush in order. Failures preserve input. |
| Generated viewers (H, I) | An atlas or review feature needs build changes | Generated-page smoke coverage. Portable output and editable data survive bundler or authoring changes. |
| Verification cost (J) | Timings show installs or duplicate runtime jobs dominate CI | Lower measured CI cost with release coverage intact and full checks for uncertain changes. [Current local gate](../README.md#verify-repo-kit) |
| Smaller candidates | Owning code changes or measured cost warrants work | Preserve Canvas action-specific types. Share the Example poller only across matching lifetimes. Measure orphaned usage-cache bytes and archive decoding before optimizing. |
| Workbench navigation and accessibility | Usage or Trace navigation changes | Check scroll restoration on return from Trace. Exercise keyboard navigation and focus through the affected flow. |
| Workbench tool catalog | The catalog or a structured tool result changes | Check that declared result schemas match the actual structured responses. |
| Workbench host and diagnostics | Installed host lifetime or diagnostics change | Verify process reuse across chats with caller isolation. Check correlation across processes for one interaction. [Runtime contract](../plugins/mcp-app-runtime/README.md) |
| Workbench performance | A panel feels slow or a large history strains memory | Measure cold load, idle traffic and large-history memory as relevant before setting budgets or splitting bundles. |
| Canvas comparison in architecture reviews | An architecture review needs a readable current/proposed comparison | Show affected files, rationale, evidence for locality, leverage and testability, recommendation strength, and conflicts with accepted ADRs. Refactoring and reopening decisions require separate intent. |

## Delivery still open

- **Authorized release** · Hosted CI at the exact revision, opt-in native Codex check, and installed-host acceptance after reload. [Workbench verification](../plugins/repo-workbench/README.md#maintain-and-verify)
- **Scope** · Template propagation and downstream backlog edits are separate work.

### Repo-scoped Workbench activation

- **Revisit when** · A repository needs its own pinned Workbench version. Use the user-wide install for routine use.
- **Observed** · On 18 November, Codex CLI `0.147.0` resolved project precedence and found both disposable repo catalogs. `plugin/list` still reported each repo copy as `installed=false, enabled=false`. [Native probe](../plugins/repo-workbench/tests/codex.test.ts)
- **Accept** · After a desktop refresh, a fresh chat in each of two trusted repos exposes exactly one Workbench at that repo's pinned version. A chat in an unrelated repo uses the user-wide version.
