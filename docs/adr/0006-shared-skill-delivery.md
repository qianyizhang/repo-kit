---
description: Deliver one pinned shared skill suite separately from Copier governance.
scope: repo-kit skill product
status: stable
last_update: 2026-10-14
document_class: coordination
---

# ADR-0006 — Shared skills have separate delivery

User decision, 2026-10-14: adopt six unchanged Matt skills plus trimmed
`next-slice` and `show-me` across personal work; retire generic wrappers, glossary
practice and maintained explainer machinery. Preserve pre-migration staged and
working content in an exact local recovery snapshot.

## Decision

`skills/` and `skills-lock.json` are the shared product. A standalone, guarded
installer updates one user-level installation. `template/` remains a separate
Copier governance product and no longer delivers generic skills. This supersedes
the shared-skill delivery part of ADR-0003; consumer ownership rules remain.

The initial migration covers game, EZ, Saul, TB3 and project-index. Older Copier
consumers require separate baseline reconciliation. Project rules and specialized
skills stay local; they resolve upstream document names without patching skill
bodies. Retro and architecture surveys remain explicitly invoked. `next-slice`
and `show-me` allow relevant automatic use.

## Reason

Keeping generic copies in each project creates unnecessary update and conflict
work. Forking Matt's instruction text adds another maintenance owner. An unchanged
upstream snapshot plus two distinct local skills lets us review updates once.
Separating delivery avoids coupling skill updates to governance migration.

## Consequence

Global changes affect all personal projects after deliberate sync. Exact source
hashes, local-edit refusal and retained previous installations make updates
inspectable and recoverable. Teams needing repo-scoped copies must deliberately
choose that deployment and avoid competing names in the same discovery context.
