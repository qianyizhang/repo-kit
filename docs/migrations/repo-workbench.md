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

## Historical evidence

### Extraction and first acceptance — 2026-10-20

Baseline: repo-kit `dd21fd2`, game `9140fcf`; Node 24.21.0, npm 11.19.0,
Codex CLI 0.147.0. Extraction retained game's 46 map modules, IDs, layout,
connections, annotations and authored case. Source logs and retained evidence
were not moved.

`npm run check` and all 23 browser tests passed; native/loopback checks skipped
in the restricted run passed separately. Tests covered configuration preservation,
private backups, collisions, malformed TOML, symlink refusal, interrupted setup,
per-project catalog isolation and saved-map/server restart behavior. Desktop
activation and interaction acceptance were not part of those automated passes.

At source `8260583d76a6`, installed runtime and Codex cache matched. The packaged
plugin was enabled and the old direct `mcp_servers.repo_canvas` registration was
absent. After the user reported restarting Codex, packaged `canvas_open`/`canvas_read`
were available; context `6f2df992-e488-4164-83dd-3b21f462307f` rendered the
user-default fixture with the correct path, Reader/Writer, shared-document status
and side chat. Native message `eb255b8c-31ae-4268-ba59-3b398e5bbe90` reached the
owning chat and a summary-only proposal returned. Its draft retained Writer at
x=406, y=57; saved bytes were unchanged. Apply/Save remained pending.

Fixtures and `acceptance.json` were retained at
`/private/tmp/repo-workbench-acceptance-kioykqdj/`:

| Fixture | Installation identity |
| --- | --- |
| `alpha` | `repo-workbench@repo-kit-93064a9de7c4`, 0.1.0 |
| `beta` | `repo-workbench@repo-kit-794f2695b2df`, 0.1.1-acceptance |
| `user-default` | Existing user-wide installation |

Beta's version was an acceptance-only label for the same runtime, not a release.
Repo setup suppressed the user identity only in the fixture project config;
trust and live project activation were not tested. The INSTALL-1 observation in
the table is from this CLI version, not a claim about every later host.

### Retired connection flow — v0.1.1 and v0.1.2

The old launch flow sent a single-use request to the owning chat and waited for
`canvas_bind`; manual selection cancelled it. Native binding
`f75c967e-dda3-4fd2-8770-b4b78b453ef4` connected project-index, and request
`6e76de6d-049c-46c7-aa5d-57adc15cab33` received a lifecycle-map proposal.
This proved the handoff/discussion route, not Save or restart recovery.

Lost requests exposed a five-minute ticket lifetime, cancellation after an
uncertain 30-second message acknowledgment, and premature unbound map polling.
The v0.1.2 fix used a renewable 30-minute inactivity lease, independent polling,
clear expiry/restart states and a waiting spinner. The screenshot alone did not
establish which failure caused the original report.

The registry initially had no entries; 22 unique Git projects from Codex's saved
inventory were registered without changing repositories. Both launchers gained
search/add-folder controls, successful opens remembered their roots, and serialized
updates protected concurrent writes. Synthetic tests covered standalone selection
and live catalog changes, including removal while an existing canvas stayed open.

| Version | Recorded verification and limits |
| --- | --- |
| 0.1.1 | 12 model/MCP and 42 Node tests; skipped native/loopback checks passed separately; 24 browser journeys; desktop/740/390 px screenshots. User install/cache matched; the active chat still needed refresh. |
| 0.1.2 | 12 model/MCP tests; 41 Node tests passed, two native/loopback skips; 24 browser journeys, including delayed acknowledgment, lease renewal/expiry, manual cancellation, no unbound polling and concurrent registry writes. Narrow/desktop captures inspected; installed/cache bytes matched. Native v0.1.2 acceptance was still pending. |

The ticket, delayed-chat-binding and spinner-specific open checks are
**superseded**, not passed: v0.2.0 removed that flow. CANVAS-1 and CANVAS-3 retain
the current selection and recovery obligations; INSTALL-1/2 retain activation.
Do not replay a removed connection protocol to close this record.
