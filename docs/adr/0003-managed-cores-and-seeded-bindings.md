---
description: Decision to manage shared cores while preserving consumer bindings.
scope: repo-kit architecture decision
status: stable
last_update: 2026-08-17
document_class: coordination
---

# ADR-0003: Manage shared cores and seed consumer bindings

- **Status**: `accepted`
- **Last Update**: 2026-08-17
- **Serves**: Copier ownership and reconciliation baseline

Copier manages shared skill cores and portable doctrine, while it seeds true
consumer bindings once and then preserves them.

## Context

Treating shared workflows as consumer-owned lets implementations drift.
Overwriting repository vocabulary, paths, policy, or verification destroys
local authority. Release tags and recorded source revisions also serve different
purposes.

## Considered options

- Seed every skill once — rejected because shared behavior would stop receiving
  fixes and simplifications.
- Manage every generated path — rejected because local meaning would be
  overwritten.
- Require tags as the only baseline — rejected because a valid Copier source
  revision can precede the next release event.

## Consequences

Shared cores update from `template/`; consumer constitutions, indexes, backlogs,
glossaries, configuration merges, and explicit binding files remain local. The
consumer's recorded `_commit` is the reconciliation baseline. Tags remain the
preferred stable checkpoints. Boundary changes require a migration handoff;
propagation is separate work.
