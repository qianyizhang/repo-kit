# Example MCP App · whole-app anatomy and redesign

Completed: the accepted sequence workspace is implemented in `43a08a4`.
[Current design](../../../../plugins/example-mcp-app/design.md) and
[wiring outcomes](../../../../plugins/example-mcp-app/tests/OUTCOMES.md) own current
behavior and verification. Superseded prototypes have been removed.

## Baseline evidence

[Open the pre-redesign anatomy map](index.html): 86 component contracts,
39 captured states, eight primary journeys and ten original findings. This is a
historical map of source `041e0d3a81d3126054f734b2f13b01bed9d95950`, not the current UI.
[Source hashes](evidence/source-sha256.json) pin the baseline. The page owns the
final component inventory and geometry; redundant preliminary measurements were removed.

Coverage includes all seven original pages, fixture/live controls, conditional
states, disclosures, history, diagnostics, dark appearance and a narrow layout.
85 contracts were visually observed; K12 (empty background traffic) remains
source-only. Rare disconnect/download-rejection variants were not separately
captured. Images came from the built app and SDK host on 22 October 2026; tools
and resources reached the real server, while chat/context handling was simulated.
Native panel rendering, message arrival and model use were not verified.

## Accepted feedback

| Finding | Implemented direction |
| --- | --- |
| Journey and interaction selectors overlapped | One scenario navigation; composite journeys highlight their phases. |
| Folding a single sentence added effort | Keep short input visible; preview payloads and pin long details. |
| Boundary cards hid exchange order | Four actor lanes with ordered events and in-place outcome variants. |
| Main conversation was missing from the actor model | Distinguish conversation, app panel, host and MCP server; mark unobserved routes. |
| Live evidence and logs needed one owner | One bounded observation store feeds sequence, log and export; real events drive incremental updates. |
| Background diagnostics had no clear purpose | Selected-interaction log by default; explain and filter housekeeping traffic. |

The real app also preserves independent drafts and error layers, makes uncertain
message recovery deliberate, and keeps evidence refresh separate from action
execution. Production capture/ingestion/projection live in `trace.ts`,
`observability.ts` and `sequence.ts`; no separate shared scaffold package or
cross-app rollout is claimed. General build guidance was promoted to
[UI/UX practices](../../../../user/practices/ui-ux.md) and
[MCP practices](../../../../user/practices/mcp-apps.md).

## Verification boundaries

At capture time, geometry/reference validation and browser checks covered map
selection, inventory, journey highlights and frozen comment targets. The original
findings inside the map remain the dated discussion record; the accepted design
above supersedes their proposed directions. Current runtime checks belong to the
app's outcome matrix. Source/package/SDK checks do not establish native acceptance.
