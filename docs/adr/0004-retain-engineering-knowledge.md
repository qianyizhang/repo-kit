---
description: Retain engineering knowledge and retire spent documentation.
scope: repo-kit architecture decision
status: stable
last_update: 2026-09-11
document_class: coordination
---

# ADR-0004: Retain engineering knowledge and retire spent documentation

- **Status**: accepted
- **Last Update**: 2026-09-11
- **Serves**: scoped authority and consumer documentation lifecycle

The user approved upstream retention rules followed by a qi cleanup trial.
Keep knowledge in its nearest sufficient owner, preserve decisions and evidence,
and delete spent coordination after checking its remaining dependencies.

## Context

The qi audit found completed delivery specifications still routed as current
design, promoted audit receipts, and guides carrying session status and repeated
results. Existing capture and archive rules lacked a clear removal step.
The proposal was prompted by the user's Skunk Works summary. Google's
[documentation guidance](https://google.github.io/styleguide/docguide/best_practices.html)
also supports concise READMEs, local rationale, and deletion of dead docs.

## Considered options

- Rank code above every document: rejected because required invariants can expose
  code defects, and code cannot recover rationale or historical observations.
- Archive all completed prose: rejected because it preserves routine reporting
  without a remaining engineering need.
- Delete by age or size: rejected because old records can own evidence, identity,
  or unresolved obligations.

## Consequences

The portable rules own retention criteria; skills apply them without a new report
schema or heuristic gate. READMEs retain essential usage and routes. Comment tags
are optional; useful local contracts and rationale stay near their code.
Consumers reconcile seeded backlog rules and preserve evidence-specific
append-only obligations and machine-reader scope. Git recovery is sufficient for
spent committed prose, but does not back up ignored artifacts. Trials should
verify preserved meaning and reader dependencies, not optimize line counts.
