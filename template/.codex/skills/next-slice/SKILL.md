---
name: next-slice
description: Verify live repository state against plans and recommend one valuable, independently testable implementation slice. Use when asked what to build next, when backlog status may be stale, or after a burst of work has outrun its plan.
---

# Next slice

Choose one repo-grounded next move. Treat planning artifacts as claims to verify,
not as substitutes for the live tree.

## Survey

1. Read the repository instruction SSOT and navigator.
2. Inspect status, recent commits, open work items, active specs, and the tests or
   implementation paths relevant to plausible candidates.
3. Read full work-item histories and implementation ledgers when present. A
   status field alone is not evidence.
4. Check completed, canceled, rejected, and blocked work before proposing a
   "new" slice.

Resolve facts from the repository. Do not ask the user to recite information the
tree owns.

## Reconcile planning state

Classify each serious candidate:

| State | Meaning |
| --- | --- |
| `ready_now` | Scoped, valuable, and unblocked after live verification |
| `stale_done` | Tracker says open, but the work has landed |
| `stale_shape` | The recorded item no longer matches current direction |
| `blocked_decision` | A named product, authority, or architecture choice is open |
| `needs_human_gate` | A named reviewer or owner must decide or assure |
| `defer` | Valid, but lower value than another current slice |
| `close_or_split` | Close it, or preserve landed work and name the residual slice |

Correct obvious planning drift only when the user asked for cleanup and the
evidence is complete. Otherwise include the correction in the recommendation.

## Rank

Prefer a slice with:

- direct value on the repository's current trajectory;
- one explicit authority boundary;
- the smallest independently verifiable behavior or artifact;
- a named verification command or manual proof;
- explicit work-item, spec, glossary, or ledger updates when applicable.

Down-rank work that broadens scope without a decision, invents work before a
human gate, repeats already-pending inventory, or hides release/deployment
authority behind code completion.

Name the completion rung using the repository's own vocabulary. If none exists,
state the concrete proof without introducing a new maturity taxonomy.

## Decide

Present the evidence and ranked recommendation first. If real choices remain,
invoke the local `grilling` primitive for only the unblocked decision frontier:

- which outcome is most valuable now;
- which authority or scope boundary applies;
- what smallest proof counts as done;
- whether evidenced stale planning state should be corrected in the same slice.

Keep dependent questions for a later round. Stay in decision mode until the
user confirms the lock; recommendation is not implementation authority.

## Output

```markdown
**Current trajectory**
<what recent evidence is converging toward>

**Planning state**
| Candidate | Evidence | Classification | Action |
| --- | --- | --- | --- |

**Recommended next slice**
- Outcome:
- Value now:
- Authority boundary:
- Smallest proof:
- Verification:
- Planning/doc updates:
- Blocked by: <named decisions, gates, or none>

**Why not the alternatives**
<short comparison>

**Decisions to lock**
<grilling questions or none>

**Implementation handoff**
<only after the user confirms: authoritative paths, steps, stop condition,
verification, and suggested skills>
```

## Completion

The recommendation is complete when its value, owner boundary, proof, and
planning updates are explicit and no fact question has been delegated to the
user. Leave unresolved choices open rather than pretending the slice is ready.
