# Repo Workbench migration acceptance

- **Goal** · One collected desktop acceptance run after the migration slices, followed by one fix round. User decision on 2026-10-20.
- **Baseline** · Checklist reviewed at `9549a5a` on 2026-10-23. Package refresh completed at `8260583`. Native outcomes below remain open.
- **Scope** · Synthetic repositories and traces for writes. Private logs and game evidence stay local. Desktop restart belongs to the collected acceptance run.
- **Current behavior** · [Workbench](../../plugins/repo-workbench/README.md) · [Canvas contract](../../plugins/repo-workbench/docs/canvas-design.md)

## Remaining acceptance

| ID | Acceptance | Recorded evidence and gap |
| --- | --- | --- |
| INSTALL-1 | Trusted npm-local repo activates exactly one repo Workbench after desktop refresh. Effective config agrees with tool status. | CLI 0.147.0 resolved repo=true/user=false, but `plugin/list` after `forceRefetch` and skill reload returned repo installed=false/enabled=false. Desktop restart pending. Repo-only activation required. |
| INSTALL-2 | Two pinned repos use their own versions. An unrelated repo uses the user install. One set of Canvas tools per repo. | Automated config/discovery coverage. Live activation pending. |
| CANVAS-1 | Explicit and app-menu/workspace/picker opens resolve the canonical repo, source access and save location. | After restart, packaged schemas and explicit open verified. Actual panel rendered the canonical user-default fixture with Reader/Writer. Picker and manual source/save pending. |
| CANVAS-2 | Owning chat receives the side-chat question. Apply updates the draft and Save writes it. Rejected or uncertain sends require a deliberate retry. | Native message `eb255b8c-31ae-4268-ba59-3b398e5bbe90` received. Reader inspected, summary-only proposal returned. Panel showed MCP REPLY and Apply to draft. Writer remained at (406, 57) and saved bytes matched. User Apply/Save pending. |
| CANVAS-3 | Two repos retain independent drafts across reload/restart. Saved maps reopen, and conflicts/stale contexts preserve target identity. | Packed map/server restart covered. Desktop draft restoration and iframe reuse pending. |
| TRACE-1 | One authorized real session and one curated export show source identity, lazy bodies, links, history and offline content. | Synthetic coverage passes. Real-data and manual acceptance pending. |
| USAGE-1 | Actual local data supports refresh, readable charts, session drill-down and offline reopen. | Automated refresh/source protection passes. Real-data and manual acceptance pending. |
| UPDATE-1 | Updated package serves new tools/UI after refresh, retaining maps and config. Stale sessions fail clearly and fresh opens work. | npm upgrade and standalone MCP restart covered. Desktop cache replacement pending. |
| GAME-1 | Installed Workbench opens the retained game map and an authorized sculpture case with captures and source-pinned evidence. | Game gates and map invariants pass. Private replay pending. |

- **Closeout** · Record client/build, outcome and evidence for each row. Require acceptance or explicit waiver. Fix failures at the owning source and rerun the affected upgrade, recovery and cross-repository checks.
- **Separate delivery actions** · Push, publication and installation into additional real repositories.

## Repeatable automated checks

- **Package and browser** · [Workbench verification](../../plugins/repo-workbench/README.md#maintain-and-verify)
- **Opt-in Codex probe** · From `plugins/repo-workbench`, run `REPO_WORKBENCH_CODEX_BIN=/absolute/path/to/codex node --test tests/codex.test.ts`. Disposable configuration and no model turns.
- **Evidence limit** · October extraction and connection trials used synthetic fixtures apart from the recorded native side-chat reply. Automated coverage leaves the desktop rows open.
