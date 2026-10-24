# Repo Workbench migration acceptance

This file owns unfinished migration acceptance and its retained evidence.
Current behavior belongs to the [Workbench README](../../plugins/repo-workbench/README.md)
and [Canvas contract](../../plugins/repo-workbench/docs/canvas-design.md).
The checklist was reconciled against `9549a5a` on 2026-10-23; this was a document
review, not a new native acceptance run.

User decision, 2026-10-20: collect desktop/restart-dependent checks and perform
them together after the migration slices are ready, followed by one final fix
round. Keep this decision; use synthetic repositories/traces for writes and do
not restart the user's app or request piecemeal checks during implementation.

## Remaining acceptance

Record the actual client/build, result and evidence for each item. Automated
coverage and historical passes do not establish current desktop acceptance.
Open outcomes require evidence or an explicit user waiver before closeout.

| ID | Current check and expected result | Last recorded evidence / remaining work |

| --- | --- | --- |
| INSTALL-1 | In a trusted repo with npm-local package, run repo setup and refresh the desktop host. Confirm package materialization and exactly one enabled Workbench. Compare effective configuration with installed-tool status. | **Open: observed gap.** CLI 0.147.0 `config/read` resolves repo=true/user=false, but `plugin/list` after `forceRefetch` and skill reload reports repo `installed=false`, `enabled=false`. No desktop restart tested. Do not substitute global `plugin add` for repo-only activation. |
| INSTALL-2 | Open two trusted repos with different pinned fixture versions, then an unrelated repo. Each pinned repo uses its own version; unrelated repo uses the user installation; no duplicate Canvas tools. | Configuration/discovery automated; live activation pending. |
| CANVAS-1 | Refresh/restart Codex once after all migrations. Open packaged Canvas with an explicit target and through the app menu/workspace lookup and picker. Verify visible canonical repo, map/source access and correct save location. | After restart, packaged schemas and explicit open are verified in this chat. Actual MCP App DOM renders the user-default fixture at its canonical path with Reader/Writer. Picker and manual source/save checks remain pending. |
| CANVAS-2 | In a disposable map send a question through side chat, receive a proposal in the owning chat, Apply to draft, then Save. Rejected/uncertain message delivery must not silently retry. | Native side-chat message `eb255b8c-31ae-4268-ba59-3b398e5bbe90` reached this chat; Reader source was inspected and a summary-only proposal returned. Actual Canvas DOM shows MCP REPLY and Apply to draft. Request draft layout (Writer x=406, y=57) preserved; saved map bytes unchanged by reply. User Apply/Save pending. |
| CANVAS-3 | Keep two repos open; edit drafts independently. Reload the UI, restart the host, reopen saved maps, and check draft recovery/conflict messages and stale contexts. Never silently retarget a dirty canvas. | Packed saved-map/server restart checks pass; desktop draft restoration and iframe reuse pending. |
| TRACE-1 | Open one authorized real development session and one existing curated export. Check source identity, lazy bodies, links, browser history and offline export. | Synthetic regression coverage passes; real-data/manual acceptance pending. Do not upload logs. |
| USAGE-1 | Open local usage, refresh, drill into a session, and reopen an offline export. Confirm read-only sources and legible charts. | Automated refresh/source protection passes; actual local-data/manual acceptance pending. |
| UPDATE-1 | Update the local package, refresh/restart once, and confirm new tool/UI version while maps/config remain intact. Check stale sessions fail clearly and fresh opens work. | npm upgrade + standalone MCP restart automated; desktop cache replacement pending. |
| GAME-1 | Open game's retained map and an authorized sculpture case with installed Workbench. Confirm the authored case, capture patterns and source-pinned evidence still resolve. | Game gates/map invariants pass; private-evidence/manual replay pending. |

After the collected run, fix failures at their owning source, add focused
regressions where useful, rerun affected gates, and review upgrade/recovery and
cross-repository behavior. The installation refresh at source `8260583` is
complete; it does not close the rows above. Pushing, publication and installation
into additional real repositories remain separate actions.

## Repeatable automated checks

Run from `plugins/repo-workbench` with its supported Node version:

```sh
npm run check
REPO_WORKBENCH_CODEX_BIN=/absolute/path/to/codex node --test tests/codex.test.ts
npm run test:browser
```

Read [Mac browser testing](../../user/practices/macos-browser-testing.md) before
launching browsers. Native checks use disposable configuration and no model
turns; the default suite skips that opt-in check. Package tests cover isolated
installation, two saved maps, upgrades and stale-context rejection. They do not
replace desktop acceptance. Private logs and retained game evidence stay local.

## Historical limit

The October extraction and connection-flow trials exercised synthetic fixtures;
one native side-chat reply was observed. Apply/Save, restart recovery and the
remaining desktop checks above were not completed. Old temporary fixture paths,
version tables and retired connection-ticket details are no longer retained.
