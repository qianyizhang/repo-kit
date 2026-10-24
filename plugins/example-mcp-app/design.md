# Example MCP App

The developer's task is to perform an interaction and explain which role handled
it, what crossed each boundary, and what the response proves.

## Roles and navigation

- Keep four roles visible: **Main conversation**, **App panel**, **Host** and
  **MCP server**. The conversation is a surface for user/assistant messages; the
  model generates assistant responses. The app panel is not another assistant.
  These roles are not four separate processes. Resolve the host's actual name.
- One scenario navigation owns selection. Failures are variants of tool/resource
  operations, not a second navigation path. Fixture outcomes are authored; Live
  offers only real operation cases and displays actual host/server responses.
- The composite **Investigate → ask** journey advances resource → tool → context
  → message with a deliberate click for every step. A failure stops continuation.
  Phase selection highlights part of that sequence; it is not duplicate navigation.

## Sequence and evidence

- Actors run horizontally. A uniquely correlated complete RPC path is shown in
  inferred sequence order; incomplete or ambiguous paths retain receipt order. Preserve source-local
  sequence and request/response interval. Vertical spacing and cross-source clocks
  do not establish latency or global causality. Late traces append to the raw log; the graph may place them into a uniquely
  correlated path, explicitly labelled as inferred ordering.
- One bounded observation store feeds the graph, log and export. Deduplicate
  repeated server snapshots by source connection and sequence; retain distinct
  identities across server restarts. Run IDs correlate operations across transports;
  equal wire IDs or nearby timestamps cannot establish that relationship.
- App/server transports capture events. Host internals remain unobserved. The
  conversation route is dashed and explicitly unobserved; it is not a fabricated
  log event. Message acknowledgment does not prove arrival or model execution.
- Keep short input visible. Hover/focus previews original input or event payload;
  click/tap pins an event in an accessible dialog with selectable text. Render
  all payloads as text. Partial tool-input notifications update a stable stream
  row while their immutable raw snapshots remain in the log. Do not synthesize
  token chunks for tools that return a complete result.
- Keep observer calls and size notifications outside the selected sequence. The
  event log defaults to the interaction. Its housekeeping filter explains when
  resizing and evidence-collection traffic is useful. Refresh only reads evidence.
- Fixture mode makes no domain/host calls and never substitutes for a failed live
  request. Standalone supports fixtures; native operations require a host bridge.

## Recovery and presentation

- Distinguish tool/application errors from protocol errors and uncertain delivery.
  After an uncertain message, check the conversation before deliberately sending
  again. A user report does not rewrite transport evidence. Never auto-resend.
- Preserve independent drafts, selected runs and focus through observation updates.
  Block overlapping domain operations. Stop observation and ignore stale results
  after teardown/disconnect; do not overwrite a captured cleanup acknowledgment.
- Place missing-evidence recovery beside the problem. Keep connection identity,
  capabilities and build diagnostics behind the connection control.
- Export session evidence before closure or deliberately choose to skip. A download
  request is not proof of file receipt. The host owns actual panel removal.
- Use paper/ink colors, teal actions, system fonts, keyboard focus and host theme.
  Narrow navigation may scroll; the four-role diagram and surrounding content fit
  the panel. Direction labels and event kind make color supplementary.

## Owners

`trace.ts` observes SDK transports; `observability.ts` owns bounded cross-source
receipt ingestion; `sequence.ts` derives actor routes and stream rows; `view.ts`
owns graph/log/payload rendering. `app.ts` owns host operations and lifecycle;
`journeys.ts` owns scenario intent and authored fixtures; `contracts.ts` validates
reports. `server.ts` owns tools/resources; `preview.ts` serves standalone fixtures.
The real-server SDK harness lives only under `tests/`.

Native plugin installation, active panel rendering, actual message arrival and
model responses remain separate acceptance checks. See [verification](README.md#verification) and the executable tests.

## Shared diagnostics adoption

Keep the four-role sequence, scenario navigation, phase focus and payload previews.
The existing connection control is App info (ⓘ); its tool catalog comes from the
bundled server’s registrations and works in standalone fixture mode without host
calls. Recording health and the canonical log location are live-only details.
The trace recorder remains the observation owner. Disk logs contain metadata by
default; **Save interaction capture** persists one selected live run. The existing
explicit session export remains available and labels its wider scope.
Model-facing diagnostics provide compact status, bounded event summaries and one
exact event. The full graph snapshot is app-only and never an ordinary message
attachment.
