---
description: Keep current ownership mutable and require worker durability when recovery matters.
scope: repo-kit architecture decision
status: stable
last_update: 2026-09-21
document_class: coordination
---

# ADR-0005: Current claims and conditional worker durability

- **Status**: accepted
- **Last Update**: 2026-09-21
- **Serves**: portable agent coordination and recovery

## Context

The claim-ledger glossary required append-only records while parallel handoff
used a current-status table without a latest-event rule. Requiring a durable file
for every worker also made short read-only findings create one-use coordination
artifacts. The user accepted both refinements after reviewing these alternatives.

## Decision

Use one mutable claim table for current ownership. The parallel handoff reference
owns its status vocabulary, reassignment, and release semantics. Keep the
implementation ledger append-only; durable decisions and recovery evidence stay
in their existing owners.

Require durable worker output for implementation, independent continuation, or
evidence that must survive the session. Code changes retain a verified commit or
recoverable patch/base, including owned untracked files. Short read-only findings
may be integrated directly into the parent response or owning record.

## Consequences

An append-only claim event stream could preserve every transition, but would need
a separate rule or projection to recover current ownership. The mutable table
keeps that coordination fact direct without creating another history owner.

Interrupted short audits may need to be repeated when their direct return has
not yet been integrated. This bounded recovery cost is preferable to mandatory
files for every lookup; work requiring independent recovery retains its durable
output obligation.
