# MCP App integration review

For an MCP App round, add `--mcp` to the scaffold command. It adds a linked
`integration.html` page with an empty, source-grounded model. Existing rounds can
copy that asset and add the link. Keep the spatial map and journeys; this page
explains the boundaries behind their controls, not a substitute product mockup.

Use the `mcp-app` skill for building/debugging the implementation. Its interaction,
observability and test references own those procedures. This supplement owns how
to make the current integration reviewable.

Populate the `mcp-review-data` JSON in `integration.html`:

- `baseline`: inspected build, source revision, mode and capture time.
- `registeredTools`: exact names from that server's `tools/list`, including
  app-only tools. Mark unavailable discovery as a coverage gap, never an empty
  “complete” catalog.
- `tools`: each tool's `name`, `purpose`, `operation` (server/domain owner),
  `visibility`, `authorization`, `effect`, `scope`, `inputSchema`, `outputSchema`,
  `example`, `source`. Explain whether it reads, proposes, applies, saves, connects
  or opens a UI. An MCP tool often wraps an operation; `ui/message` and model
  context updates are separate host methods, not necessarily server tools.
- `fixtures`: `id`, `name`, `kind` (`plain`, `selection` or `failure`),
  `mode` (`fixture` or `observed`), `source`, `request`,
  `result`, `reads` (tool names and scope), `sequence` (ordered `from`, `to`,
  `action`, `evidence`). Include plain “hi”, a selected-context message, and an
  uncertain/rejected outcome. Show actual data and its limits, not opaque IDs
  alone. The page derives an actor-to-actor sequence from these records.
- `logPolicy`: actual canonical path/owner, payload policy, retention, recording
  failures and how to inspect one interaction without repeating it.
- `standalone`: supported domain actions and explicit unavailable/copy behavior.
- `coverageGaps`: specific unobserved host internals or unavailable product states.

The page must distinguish what the app sends directly, what the assistant can
pull later, what reaches model context, and what stays panel/server-local. Tool
schemas and catalog metadata should be exported from canonical registrations;
`registeredTools` should come from an independent protocol probe. Examples are
fixtures until their capture origin establishes otherwise. Never invent hidden
host/model steps to complete the graph.

Include App info, connection/delivery/save state, tool catalog, each interaction's
payload inspector, and log-failure/standalone states in the spatial inventory and
journeys. Inspect a real payload in the running app. Record source-only findings
as provisional. Feedback on the integration page freezes the selected tool or
fixture and the inspected baseline.

Validate the supplement before handoff:

```sh
python3 /path/to/ui-discussion/scripts/validate_integration.py /absolute/round/integration.html
```

This checks catalog coverage, schemas, required fixture kinds and sequence
references. It cannot certify source truth, privacy, usable layout or live host
acceptance. Run the normal spatial/journey readiness check too, then inspect both
rendered pages. Promote accepted contracts to existing code/design owners and
retire the temporary bundle with the main review.
