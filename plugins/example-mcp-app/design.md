# Example MCP App

The developer's task is to perform one interaction and explain which component
handled it, what crossed each boundary, and what the response proves.

- Organize the app around journey pages: startup, tools, resources, context,
  messages, errors and teardown. Each page states its expected behavior before
  presenting its controls and results.
- Fixture mode is a local deterministic teaching example. It must not call tools,
  update model context, send messages or silently substitute for a failed live run.
  The standalone browser serves fixtures only. Live mode requires a host bridge.
- Show one interaction per click. Give it a stable run ID carried through tool
  arguments or resource URIs; do not correlate separate transports by timing or
  coincidentally equal JSON-RPC IDs. Keep wire IDs in expandable details.
- Use three responsive columns for App, Host and Server. App/server events are
  captured at their transports. Host forwarding is explicitly inferred; actual
  host acknowledgments can be described as observed bridge responses.
- Hide observer calls and sizing notifications from journey evidence. Offer an
  explicit background-traffic disclosure. Refresh evidence performs one fetch.
- Give the app, host and server explicit names. Directions and text describe
  events; color is only a secondary cue.
- Show startup evidence as observations, not a prescribed ordering: hosts may
  preload HTML before calling the entry tool.
- Keep JSON behind expandable event details. Preserve request IDs, errors, timings and
  provenance. Label truncation, redaction, observer calls and missing visibility.
- Use a quiet paper/ink palette with teal accents, system fonts, readable spacing,
  keyboard focus, host theme support and a stacked layout on narrow panels.
- Keep the test host in test-only files. Native plugin installation, cache build,
  active sidebar panel and live message delivery are separate acceptance checks.
- Let the agent read a bounded, explicitly app-reported trace snapshot through
  the server. This provides evidence when host UI automation is unavailable;
  it is not a substitute for native message arrival in the owning conversation.

Ownership: `server.ts` registers tools/resources; `trace.ts` observes transports;
`app.ts` owns the embedded interface; `journeys.ts` owns teaching examples and
journey definitions; `contracts.ts` owns wire/report validation; `preview.ts`
serves the fixture-only page. The host test harness lives under `tests/`.
No repository data, model credentials or external services are needed.
