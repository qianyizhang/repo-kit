---
name: handoff
version: "0.10.0"
description: >-
  Transfer work across sessions or coordinate explicitly authorized parallel
  writers. Use when another owner needs durable state or concurrent edits need claims.
scope: session and multi-agent coordination skill
status: experimental
last_update: 2026-09-12
document_class: artifact
---

# Handoff

Preserve enough authoritative state for the next owner to continue without chat
memory. Use this when transferring work or when context loss threatens continuity.
Ordinary tool calls and work-item boundaries do not require a packet.

## Select the mode

- **Session:** one writer transfers or pauses work. Read
  [session handoff](references/session.md) for the packet and closeout rules.
- **Parallel:** explicitly authorized concurrent writers need ownership claims.
  Read [parallel writers](references/parallel.md) for claims, durable outputs,
  and integration. Read the session reference only when also transferring context.

This skill does not authorize additional writers or expand product scope. Keep
one owner per surface, including transitive writes from tests and generators.
Product decisions remain in their owning authorities.

## Completion

Write the durable packet or worker output before summarizing it in chat. Link
authorities and evidence instead of copying them. Include authorization, completed
and remaining work, verification scope, and the next action. Redact secrets and
personal data. Reuse an existing packet for continuing state.

The agent judges whether context is sufficient; repository checks and observed
artifacts support its claims. Preserve active operator state and evidence needs;
apply `docs/rules/doc.md` closeout when the packet or ledger is spent.
