---
description: Core concepts and relationships governing repo-kit's evolution and distribution.
scope: repo-kit core model
status: stable
last_update: 2026-10-24
document_class: coordination
---

# Repo-kit core model

## Product boundary

| Concept | Owner and outcome |
| --- | --- |
| **Candidate** | Evidence from local work, a consumer or an upstream. Explicit promotion recreates the smallest justified change in its product owner. |
| **Personal instructions** | Repo-kit owns defaults in `user/`. Guarded sync delivers them at user scope. [Instruction maintenance](user-instructions.md) |
| **Shared skills** | Repo-kit owns selection, adaptations, lock and user-scope delivery from `skills/`. [Skill maintenance](skill-suite.md) |
| **Governance template** | Repo-kit owns portable rules, checks and bootstrap from `template/`. [Copier delivery](../README.md#apply-or-update) |
| **Executable plugins** | Repo-kit owns tool behavior. npm and the user or repo catalog deliver the prebuilt package. [Workbench](../plugins/repo-workbench/README.md) |
| **Consumer binding** | The repository owns local language, paths, policy, verification, maps, cases and evidence. |

## Deliberate evolution

| Owner | Outcome |
| --- | --- |
| Core model | Shared vocabulary and relationships |
| Campaign | Bounded destination with uncertainty and coordination across sessions |
| Work item | Precise work, acceptance and implementation state |
| ADR or SSOT | Settled decision or durable facts |
| Code and tests | Behavior and executable checks |

- **Campaign record** · Destination, model relationship, current understanding, fog (material unknowns), frontier (unblocked work or decisions), links to existing evidence and work, learning and closeout.
- **Closeout** · Promote settled outcomes to their owners or record why a change lacked support. Use a work item for bounded changes and a finite series for recurring destinations.

## Delivery baseline

- **Kit-managed** · Files delivered from `template/` outside Copier's `_skip_if_exists` list.
- **Consumer-owned** · Seeded constitution, index, backlog, glossary and local configuration.
- **Reconciliation** · `.copier-answers.yml` records `_commit`, the actual baseline. Tags mark preferred release checkpoints. [Older consumer migration](../.codex/skills/maintain-repo-kit/references/migration-handoff.md)

## Decisions

| Decision | Rationale and owner |
| --- | --- |
| Scoped authority · 17 August | The concern's owner decides which evidence to accept. Promotion and downstream delivery require separate authorization. |
| Bounded Campaigns · 17 August | Changing uncertainty across sessions needs a map linked to existing work and evidence. Adapted from Wayfinder. [Attribution](../.codex/skills/maintain-repo-kit/references/upstreams.md#mattpocockskills) |
| Managed doctrine, local bindings · 17 August | Shared fixes propagate while local policy survives updates. The Copier seed list owns the boundary. |
| Finite evidence retention · 11 September, revised 24 October | Retain major outcomes and explicit obligations. Promote useful decisions before retiring spent material. [Artifact rules](../user/practices/artifacts.md) |
| Current claims and conditional recovery · 21 September | One current claim table. Work records own material history. Durable handoff supports implementation or independent continuation. [Coordination terms](../template/docs/rules/agentic-glossary.md#coordination) |
| Shared skills outside Copier · 14 October, revised 23 October | A guarded user installation removes per-repo copies and decouples governance migrations. Preserve metadata and licenses. Repo-scoped teams must avoid competing discovery names. [Skill maintenance](skill-suite.md) |
| Personal instructions outside Copier · 22 October | One source and explicit sync avoid copied defaults. `AGENTS.md` is canonical, Claude files point to it, and project contracts and OS-specific defaults keep their scope. [Instruction maintenance](user-instructions.md) |

- **Decision history** · Condensed from ADR-0001–0007. Record new decisions in their existing owner. Use a separate ADR where the rationale needs one.
