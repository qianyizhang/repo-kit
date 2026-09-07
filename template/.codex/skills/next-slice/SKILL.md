---
name: next-slice
version: "1.3.1"
description: >-
  Verify live repository state against plans and recommend one valuable,
  independently testable implementation slice. Use when asked what to build
  next or to reassess readiness and priority against current planning evidence.
scope: repository next-slice recommendation
status: stable
last_update: 2026-09-07
document_class: artifact
---

# Next slice

Choose one repo-grounded next move. Planning artifacts are claims to verify, not
substitutes for the live tree. Use `show-gap` to assess a particular feature
request and `show-me` to explain existing behavior; this skill selects work.

## Survey

1. Read the repository instruction SSOT and navigator.
2. Inspect status, recent commits, active Campaigns, open work items, active
   specs, and relevant implementation or tests.
3. Read full work-item histories and ledgers for serious candidates; a status
   field alone is not evidence.
4. Check completed, canceled, rejected, and blocked work before proposing
   something new.

Resolve facts from the repository. Do not ask the user to recite what the tree
owns.

## Reconcile planning state

| State | Meaning |
| --- | --- |
| `ready_now` | Scoped, valuable, and unblocked after live verification |
| `stale_done` | Tracker says open, but the work landed |
| `stale_shape` | The recorded item no longer matches current direction |
| `blocked_decision` | A named product, authority, or architecture choice is open |
| `needs_human_gate` | A named reviewer or owner must decide or assure |
| `defer` | Valid, but lower value than another current slice |
| `close_or_split` | Close it, or preserve landed work and name the residual |

Correct planning drift only when the user requested cleanup and evidence is
complete. Otherwise include the correction in the recommendation.

## Rank

Prefer direct value on the current trajectory, one explicit authority boundary,
the smallest independent proof, a named verification command, and explicit
work-item or documentation updates.

When an active Campaign applies, prefer its current frontier or explain why a
different slice has higher value. A Campaign supplies coordination context; it
does not override work-item or product authority.

For a materially cross-cutting candidate, state which core-model relationship it
preserves or changes. Do not add model ceremony to a local slice.

Down-rank work that broadens scope without a decision, invents work before a
human gate, repeats pending inventory, or hides release authority behind code
completion. Use the repository's completion vocabulary; if none exists, state
the concrete proof.

## Decide

Present evidence and one ranked recommendation. If choices remain, invoke
`grilling` only for the unblocked value, scope, proof, or planning-correction
decisions. Recommendation is not implementation authority.

## Output

Lead with one recommended outcome and why it matters now. Include the evidence,
authority boundary, smallest proof, verification command, and needed planning
updates. Compare alternatives only when they affect the choice.

Use a planning-state table when several candidates need reconciliation. Include
Campaign/model relationships and unresolved decisions only when material; omit
empty fields. The output is a recommendation, not a new plan or tracker.

Stop after one recommendation. If confirmed work moves to another session, use
`handoff` for transport; implementation still requires explicit user authority.

## Completion

Value, owner boundary, proof, and planning updates are explicit, and no factual
question has been delegated to the user. Leave unresolved choices open rather
than pretending the slice is ready.
