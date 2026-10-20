# Migration acceptance and final fix round

This is the collective acceptance list for the Repo Workbench migrations: Canvas,
session review/trace, usage, installation, and the game consumer. Add subsequent
migration checks here. Keep implementation detail with its owning source; this
list owns the deferred acceptance and final fix round only.

User decision, 2026-10-20: continue automated verification now. Collect checks
requiring a desktop restart or the user's manual interaction; perform them once
all migration slices are ready, then complete one final fix round. Do not restart
the user's app or ask for piecemeal manual checks during implementation.

## Automated evidence

Reviewed source baseline: repo-kit `dd21fd2`, game `9140fcf`. The installation/lifecycle
follow-up adds scoped setup and the checks below. Node 24.21.0, npm 11.19.0, Codex CLI 0.147.0.

| Area | Evidence and limit |
| --- | --- |
| Extraction | Game retains its 46 map modules, IDs, layout, connections, annotations and authored case; source logs and retained evidence were not moved. Prior migration gates passed. |
| Scoped setup | Tests cover project enablement, user-version suppression only in project config, preserved unrelated settings/comments, repeat runs, private backups, collisions, malformed/unsupported TOML, symlink refusal, and interrupted setup recovery. |
| Native configuration | Opt-in `tests/codex.test.ts` uses disposable configuration and model-free app-server requests. Two projects get distinct effective plugin identities; unrelated cwd keeps the user default. User config remains byte-identical. |
| Native discovery | CLI discovers each project catalog, both skills and the Canvas MCP declaration; a restarted app-server reads an updated fixture version. This is discovery, not active desktop tool attachment. |
| Packed lifecycle | `tests/package.test.ts` installs with scripts disabled, runs CLI/MCP, saves two independent maps, installs a new fixture package version, restarts MCP, rejects stale context IDs, and reopens identical saved map bytes. |
| UI and data | Existing browser suite covers Canvas drafts/proposals and source previews, session navigation and offline exports, usage refresh and source mutation. Desktop host behavior remains separate. |

Verification on 2026-10-20: `npm run check` passed; its native opt-in and
sandbox-blocked loopback checks passed separately. The complete browser suite
passed **23/23**. No desktop restart or user-manual acceptance was performed.

Re-run from `plugins/repo-workbench`:

```sh
npm run check
REPO_WORKBENCH_CODEX_BIN=/absolute/path/to/codex node --test tests/codex.test.ts
npm run test:browser
```

Browser launches on macOS require approved execution outside the restricted
sandbox and disposable profiles. Native checks start no model turns and do not
change the user's configuration. A default test run skips the opt-in native check.

## Collected host and manual checks

Use temporary repositories and synthetic traces for acceptance. Record result,
client version and evidence in the Result column; an automated proxy is not a
manual pass. Keep this table open until the final fix round is complete.

| ID | End-of-migration check and expected result | Result |
| --- | --- | --- |
| INSTALL-1 | In a trusted repo with npm-local package, run repo setup and refresh the desktop host. Confirm package materialization and exactly one enabled Workbench. Compare effective configuration with installed-tool status. | **Open: observed gap.** CLI 0.147.0 `config/read` resolves repo=true/user=false, but `plugin/list` after `forceRefetch` and skill reload reports repo `installed=false`, `enabled=false`. No desktop restart tested. Do not substitute global `plugin add` for repo-only activation. |
| INSTALL-2 | Open two trusted repos with different pinned fixture versions, then an unrelated repo. Each pinned repo uses its own version; unrelated repo uses the user installation; no duplicate Canvas tools. | Configuration/discovery automated; live activation pending. |
| CANVAS-1 | Refresh/restart Codex once after all migrations. Open packaged Canvas with an explicit target and through its picker. Verify visible canonical repo, map/source access and correct save location. | Current chat still exposes the old no-context `canvas_read` schema; read-only probe returns game. This proves the old connection is alive, not that the new plugin is attached. |
| CANVAS-2 | In a disposable map send a question through side chat, receive a proposal in the owning chat, Apply to draft, then Save. Rejected/uncertain message delivery must not silently retry. | Browser harness passes; native host/manual check pending. |
| CANVAS-3 | Keep two repos open; edit drafts independently. Reload the UI, restart the host, reopen saved maps, and check draft recovery/conflict messages and stale contexts. Never silently retarget a dirty canvas. | Packed saved-map/server restart checks pass; desktop draft restoration and iframe reuse pending. |
| TRACE-1 | Open one authorized real development session and one existing curated export. Check source identity, lazy bodies, links, browser history and offline export. | Synthetic regression coverage passes; real-data/manual acceptance pending. Do not upload logs. |
| USAGE-1 | Open local usage, refresh, drill into a session, and reopen an offline export. Confirm read-only sources and legible charts. | Automated refresh/source protection passes; actual local-data/manual acceptance pending. |
| UPDATE-1 | Update the local package, refresh/restart once, and confirm new tool/UI version while maps/config remain intact. Check stale sessions fail clearly and fresh opens work. | npm upgrade + standalone MCP restart automated; desktop cache replacement pending. |
| GAME-1 | Open game's retained map and an authorized sculpture case with installed Workbench. Confirm the authored case, capture patterns and source-pinned evidence still resolve. | Game gates/map invariants pass; private-evidence/manual replay pending. |

## Final fix round

- [ ] Finish all agreed migration slices and refresh the local package once.
- [ ] Perform the collected desktop/manual checks together; record each outcome.
- [ ] Resolve INSTALL-1 or document a supported repo-only activation route. Effective
  configuration alone does not satisfy this item.
- [ ] Fix failures at the owning source, add a focused regression where meaningful,
  and rerun the failed check plus relevant gates.
- [ ] Review clean upgrade/recovery and cross-repository behavior after those fixes.
- [ ] Close this list only when each item has evidence or an explicit user waiver.

Publication, pushing and installing into additional real repositories remain
separate actions; this checklist grants none of them.
