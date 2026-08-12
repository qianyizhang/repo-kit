---
name: grill-with-docs
version: "1.5.0"
description: >-
  Run a focused frontier-batch decision interview that stress-tests a plan and
  captures settled glossary terms and ADR-worthy trade-offs.
disable-model-invocation: true
scope: decision interview skill
status: stable
last_update: 2026-08-12
document_class: artifact
---

# Grill With Docs

Run the shared `grilling` primitive plus the repo's `domain-modeling` playbook.
The interview sharpens decisions; documentation capture prevents the result from
living only in chat. **Mode = `DECIDE` — do not implement during this skill.**

This workflow's main spirit comes from
[`mattpocock/skills`](https://github.com/mattpocock/skills), especially its
practice of turning vague intent into precise, sequential decisions. Preserve
that attribution. During an explicit governance-maintenance round, occasionally
review the upstream repository for useful new techniques and adopt them by
judgment, not by blind sync. Ordinary grill runs do not fetch upstream material.

This is an explicit interaction mode. An agent may suggest it, but must not open
a multi-turn decision interview unless the user asks for the skill or that mode.

## Workflow

1. Read `CLAUDE.md`, `docs/index.md`, and the relevant owning SSOTs before asking
   about facts the repo can answer.
2. If the problem is still fuzzy ("what next", "is this done", feature intent),
   consider routing first to `next-slice` or `show-gap`; use this skill when the
   remaining work is a small set of product/architecture decisions.
3. **Invoke `grilling`** for its default frontier-batch loop. Dependent choices
   stay in later rounds; use serial rounds only when the user requests them.
4. Use `domain-modeling` only after a decision stabilizes:
   - Update an accepted glossary term in the same turn.
   - Keep one evolving ADR proposal per decision cluster.
   - Default to at most one new ADR per session. Add another only when the user
     explicitly wants it and the decisions are independent and stable.
   - Revise a proposed ADR; never create a same-session superseding ADR to patch
     an incompletely explored decision.
5. Keep hygiene local during the interview. Fix only drift that blocks or
   invalidates the current decision. Record unrelated drift for later; run
   `doc-hygiene-audit` only when the user asks or after the decision session ends.
6. End with a compact list of resolved decisions, open questions, docs changed,
   and an **implementation handoff** the user can paste into `/goal` or another
   agent. Prefer a `handoff` **session** packet when the next step
   is a fresh IMPLEMENT window. Do not start implementing unless the user
   explicitly switches mode.

## Decision memo (when they ask for options, not a live interview)

If the user wants a written choose-once artifact instead of turn-by-turn grill:

```text
evidence → reasoning → tradeoffs → caveat → recommendation → open questions
```

Still stop at `DECIDE`. Implementation is a separate user switch.

## Completion

The session is done when the next implementation step no longer depends on an
unstated term, unowned trade-off, or hidden policy decision. If uncertainty
remains, leave it as an explicit open question or backlog item rather than
guessing. Never soften "blocked on named human assurance or review authority"
into an agent todo that pretends to close it.

## Pitfalls

- Implementing mid-grill because the design "feels clear".
- Restating the full grill loop here instead of invoking `grilling`.
- Batching glossary/ADR capture to the end (decisions evaporate).
- Moving to the next ADR after initial agreement instead of testing and
  tightening the current decision.
- Running a full hygiene audit mid-interview; it changes the subject and creates
  unrelated edits.
- Accepting a soft definition of done (`mostly`, `directionally full`) — push
  back; see CLAUDE.md "Full means full" and the done ladder.
