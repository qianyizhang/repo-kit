# Repo-kit audit backlog

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

## Delivery still open

- **Authorized release** · Hosted CI at the exact revision, opt-in native Codex check, and installed-host acceptance after reload. [Workbench migration acceptance](migrations/repo-workbench.md)
- **Scope** · Template propagation and downstream backlog edits are separate work.
