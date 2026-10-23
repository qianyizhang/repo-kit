# Workbench ownership and lifecycle

Open [the interactive HTML report](index.html). The [baseline audit](../2026-10-23-mcp-review/README.md)
and [written review](../../../reviews/2026-10-23-plugin-review.md) preserve the original evidence.

## Accepted decisions

The user accepted all earlier recommendations, then explicitly settled:

1. Identity, ownership, capabilities, policy and allowed transitions are immutable
   per instance. State changes through commands. Reconnect creates a new lifetime;
   product owners explicitly recover drafts.
2. Hosted context-scoped operations require trusted caller identity. Standalone
   adapters choose an explicit local principal. Unknown callers do not share an owner.
3. The existing diagnostics feature may be reviewed and committed as a separate
   prerequisite, followed by this task's architecture commit.

The prerequisite is **e434aaa**. Concurrent documentation cleanup **0adfdc5** is
another contribution. The original review baseline was **9549a5a** plus the diagnostics
work. This round changes the shared runtime, product adapters, regression tests,
CI and documentation. It does not install or publish a plugin.

## Implementation owners

- [Shared runtime](../../../../plugins/mcp-app-runtime/README.md): immutable host
  session, caller-scoped registry, interaction journal, private storage and poller.
- [ReportSession](../../../../plugins/repo-workbench/packages/reports/session.ts):
  worker, initial scan cache, revision adoption, lazy readers and bounded traces,
  shared by HTTP and MCP.
- [Discussion transactions](../../../../plugins/repo-workbench/packages/runtime/file-transaction.ts):
  process-scoped SQLite lock and atomic JSON replacement. The operating system
  releases the lock after a killed writer.
- [Review parser](../../../../plugins/repo-workbench/packages/session-review/src/model/document.ts):
  nested validation of authored v2 and recorded v3 documents.
- [Release receipt](../../../../plugins/mcp-app-runtime/src/release.ts): source and
  dependency inputs are distinct from emitted asset hashes and live activation.

The Example teaching trace remains a separate projection. The independent MCP App
starter is a pinned adaptation with a drift receipt, not an import of repository
source. Each shipped plugin bundles its dependencies and runs independently.

## Verification

The [verification receipt](evidence/verification.json) and
[implementation hashes](evidence/implementation-sha256.json) identify the tested
candidate. Three fresh empty-cache npm installs passed. Required source checks
passed: runtime 10 tests; Workbench 44 Vitest and 54 Node passes; Example 12 Node
passes. Browser suites passed **45/45** and **11/11**. The separate approved
standalone loopback run passed **10/10**. Root tests passed **105/108** with three
optional Copier skips; skills and pinned Ruff gates passed. The normal Workbench
check's sandbox loopback skip is covered by the separate run; its optional native
configuration probe remains unrun.

Review used two passes in this session, not an independent reviewer. It caught
and repaired lost initial-cache reuse, v2 document compatibility, lost typed
errors, an incorrectly mixed source/package fixture, and inspector focus loss
under polling. The report's controls explain the lifetime; they are not host
integration tests.

Source/package checks, SDK host fixtures and native installed panels are separate
acceptance layers. Native activation and live cross-chat process sharing remain
unverified. A host acknowledgment is not evidence of an assistant answer.

The HTML has no remote assets. Its bounded preview serves only that file; relative
source links are intended for the saved checkout. The original [ownership capture](ownership-preview.jpg)
records the proposal view before implementation. New captures identify the updated
report and synthetic application fixtures separately.

## Visual checks

The IAB review inspected the actual Canvas resource inside an SDK fixture host:
[App info](evidence/canvas-info.jpg) has aligned labels and one entry point;
[the final interaction view](evidence/canvas-interaction-final.jpg) retains the
exact whitespace-bearing request and keeps focus during polling. The earlier
interaction capture predates that repair and is retained as review evidence.

The [implemented ownership map](evidence/implemented-ownership.jpg) was inspected
at desktop width. The [narrow lifecycle view](evidence/report-narrow.jpg) uses a
390 px frame (375 px content plus scrollbar), with equal client and scroll widths.
Connect, send, close, new instance and late completion showed the expected result.
The diagram and UI captures are distinct from installed native acceptance.
