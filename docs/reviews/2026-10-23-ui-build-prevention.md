# Prevent UI failures during design and building — 2026-10-23

Owners: `user/AGENTS.md` routes early reads; `user/practices/ui-ux.md` owns
portable interaction judgment; `user/practices/mcp-apps.md` owns integration
and observability guidance. This file records provenance, not another rulebook.

## Evidence and scope

The user reviewed the Example MCP App proposal in chat
`01a16320-ba32-7171-9894-636f7a00d74b`, then requested real wiring and tests.
Direct feedback identified duplicated journey/interaction selection, unnecessary
folding of a single sentence, boundary cards that obscured event order, unclear
background diagnostics and confusion between the conversation, panel, host and
server. They requested a shared event graph/log with real incremental updates.
Their follow-up explicitly asks for these lessons before building or proposing,
because `ui-discussion` often arrives only after the problems exist.

Clean implementation evidence at `43a08a4cb59f`:
`plugins/example-mcp-app/design.md` records product meaning and
`plugins/example-mcp-app/tests/OUTCOMES.md` records the wiring/outcome matrix.
These files remain product owners. The general guides do not prescribe that
app's exact layout, operations or test harness. Earlier proposal artifacts and
uncommitted skill work were not promoted as authoritative implementation.

## Review of the written guidance

| Case | Preventive decision |
| --- | --- |
| New interface proposal | Read UI guidance before design; establish shared names and sketch layout plus journey. |
| Two controls selecting the same task | Use one navigation owner; a composite journey exposes only its applicable actions. |
| One-line input versus a large payload | Keep the input visible; preview supplemental context and inspect long content deliberately. |
| Exchanges across an app and backend | Choose an event sequence with named roles; unobserved roles remain understandable without invented events. |
| Live MCP trace | Capture once for graph/log/export; preserve observations, label inference and never synthesize streaming. |
| Small cosmetic edit | Inspect affected context; no mandatory exhaustive map, new ledger or UI-discussion invocation. |

This is a manual consistency review of instructions, not a measured agent trial.
Sync/check verifies delivery of the source guidance, not future agent compliance.
The installed app's native acceptance remains separate from guidance delivery.
