---
name: grill-with-docs
version: "1.7.1"
description: >-
  Run a focused frontier-batch decision interview that stress-tests a plan and
  captures only settled model changes, glossary terms, and ADR-worthy
  trade-offs.
disable-model-invocation: true
scope: decision interview skill
status: stable
last_update: 2026-08-17
document_class: artifact
---

# Grill With Docs

Run the shared `grilling` primitive and route settled documentation to
`domain-modeling`. This skill interviews and records decisions; it does not
implement them. **Mode = `DECIDE`.**

Adapted from
[`mattpocock/skills`](https://github.com/mattpocock/skills). Review that upstream
only during explicit governance maintenance, never during an ordinary grill.

This is an explicit interaction mode. An agent may suggest it but must not start
a multi-turn interview unless the user asks for the skill or mode.

## Workflow

1. Read `CLAUDE.md`, `docs/index.md`, the owning SSOTs, and any active Campaign
   framing the decision. Resolve repository facts before asking the user.
2. If the problem is still fuzzy, route feature intent to `show-gap` and
   “what next?” or readiness questions to `next-slice`. Use this skill when the
   remaining work is a bounded decision frontier.
3. When a decision materially changes a cross-cutting core model, state the
   current and proposed relationship before implementation-level choices.
4. Invoke `grilling` with its frontier-batch default. Ask all independent
   questions now and defer dependent ones.
5. After a decision stabilizes, invoke `domain-modeling` to persist only the
   accepted model, glossary, or ADR change; follow that skill's record limits.
6. End with resolved decisions, open questions, changed authorities, and the
   next implementation action. Use `handoff` only when another session needs a
   durable packet.

Keep unrelated hygiene out of the interview. Record it for later unless it
invalidates the current decision.

## Decision memo

When the user wants a choose-once artifact rather than a live interview, use:

```text
evidence -> reasoning -> trade-offs -> caveat -> recommendation -> open questions
```

Stop at `DECIDE`. Implementation requires a separate user switch.

## Completion

The next action no longer depends on an unstated term, unowned trade-off, or
hidden policy choice. Leave remaining uncertainty explicit. A named human review
or assurance gate remains human-owned.

## Pitfalls

- Implementing mid-interview.
- Restating `grilling` or `domain-modeling` mechanics here.
- Treating a first answer as a final lock.
- Deferring settled vocabulary or ADR capture until the end.
- Starting unrelated hygiene work.
