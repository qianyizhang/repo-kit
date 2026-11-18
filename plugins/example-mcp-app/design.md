# Example MCP App

- **Goal** · Explain the role, payload and evidence at each boundary of a developer interaction.

## Roles and navigation

| Surface           | Outcome                                                       |
| ----------------- | ------------------------------------------------------------- |
| Main conversation | User/assistant messages. Model generates assistant responses. |
| App panel         | Teaching scenarios and evidence inspection                    |
| Host              | Actual named bridge and its observed responses                |
| MCP server        | Tool and resource execution                                   |

- **Roles** · Four visible roles. Process count is independent of role count.
- **Scenario navigation** · One selection. Tool/resource errors are scenario variants. Fixtures are explicitly authored. Live actions show actual responses.
- **Investigate → ask** · Resource → tool → context → message, with one deliberate click per action. Failed actions stop progression. Phase focus highlights the matching sequence.

## Sequence and evidence

| Evidence           | Display and meaning                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Correlation        | User clicks create interaction IDs. Tool args/resource URIs carry them across the host. App/server SDK transports capture envelopes. Wire IDs match requests/responses on one connection and may be rewritten.                             |
| Ordering and time  | Complete uniquely correlated RPC paths use labelled inferred order. Ambiguous paths use receipt order. Durations reflect one capture point. Cross-source clocks and vertical spacing do not establish global causality or round-trip time. |
| Conversation route | Dashed and explicitly unobserved. A bridge acknowledgment establishes acknowledgment only. Teardown notification does not establish panel removal.                                                                                         |
| Event store        | Graph, log and export share one bounded store. Deduplicate by source instance and sequence across overlapping reads. Late server observations append to the log.                                                                           |
| Payload            | Show short input. Hover/focus previews the original. Click/tap pins selectable text in an accessible dialog. Real partial inputs update a stable stream row and retain raw records. Complete results stay complete.                        |
| Housekeeping       | Default log filters to the interaction. Observer and resize records are available separately. Refresh reads one snapshot without its own response. Pending operations use bounded, non-overlapping observation reads.                      |

## Recovery and presentation

- **Outcome states** · Success, tool `isError`, protocol error and uncertain timeout stay distinct. Check the chat before deliberately resending uncertain messages. A report of delivery leaves transport evidence intact.
- **Interaction state** · Independent drafts, runs and focus survive updates. Overlapping domain operations are blocked. Teardown/disconnect stops observation and ignores stale results while preserving captured cleanup acknowledgment.
- **Diagnostics** · Recovery beside the missing evidence. App info (ⓘ) shows build, host, capabilities and tools. The fixture catalog uses bundled registrations. Log location and write health require live mode.
- **Closure** · Export before closure or explicitly skip. Download requests do not prove receipt. The host removes the panel.
- **Appearance** · Paper/ink roles, teal actions, system fonts, visible focus and host theme. Narrow navigation can scroll. The diagram and content fit the panel. Use direction labels and event kinds alongside color.

## Owners

| Source                            | Responsibility                                                    |
| --------------------------------- | ----------------------------------------------------------------- |
| `trace.ts`                        | SDK transport and request/run correlation                         |
| `observability.ts`, `sequence.ts` | Bounded observations, actor routes and stream rows                |
| `view.ts`                         | Graph, log and payload rendering                                  |
| `app.ts`, `journeys.ts`           | Host lifecycle, operations, scenario intent and authored fixtures |
| `contracts.ts`, `server.ts`       | Report validation/storage and tool/resource registration          |
| `preview.ts`, `tests/`            | Standalone fixture server and test-only SDK harness               |

- **Acceptance** · [Verification](README.md#verification)
