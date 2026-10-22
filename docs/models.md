---
description: Core concepts and relationships governing repo-kit's evolution and distribution.
scope: repo-kit core model
status: stable
last_update: 2026-10-22
document_class: coordination
---

# Repo-kit core model

Repo-kit owns personal instructions, shared skills, a separate governance template,
and optional executable plugins, without taking authority from project-specific
rules or evidence.

## Product boundary

| Concept | Role | Authority |
| --- | --- | --- |
| **Candidate** | Evidence from local work, an upstream, or a consumer. | Evidence only. |
| **Personal instructions** | Working core in `user/AGENTS.md` and on-demand topic guides in `user/practices/`, explicitly synced to this user's Codex home. | This user; repositories retain project-specific authority. |
| **Shared skills** | Ten skills in `skills/`, pinned by `skills-lock.json` and installed at user scope. | Upstream text belongs to Matt; repo-kit owns selection, local skills and delivery. |
| **Governance template** | Files intentionally exported from `template/` through Copier. | Repo-kit. |
| **Executable plugin** | Prebuilt Repo Workbench package in `plugins/repo-workbench/`, installed through npm and a user/repo plugin catalog. | Repo-kit owns tool behavior; target repositories own maps, case definitions and evidence. |
| **Consumer binding** | Repository-specific language, paths, policy, and verification. | That consumer. |

```text
Candidate -- explicit promotion --> skills/ -- standalone sync --> user installation
Candidate -- explicit promotion --> user/ -- explicit sync --> personal Codex defaults
Candidate -- explicit promotion --> template/ -- Copier --> governance consumer
Candidate -- explicit promotion --> plugins/ -- npm/plugin catalog --> optional tool installation
Consumer binding -- local meaning and policy -------------> project work
```

Promotion recreates the smallest justified change in the portable product.
Copying, surveying, or observing a delta never transfers authority.

## Deliberate evolution

A project is understood through core models, evolved deliberately through
Campaigns, locked through ADRs and SSOTs, and realized through work items.

A **Campaign** is a bounded coordination map for a destination whose route is
not yet clear. It records:

- destination, relevant model relationship, and current understanding;
- fog: known-to-matter unknowns;
- frontier: decisions or work that are unblocked now;
- links to work, evidence, and decisions;
- learning that changes the map; and
- closeout and promoted outcomes.

A Campaign is not an authority, duplicate store, or backlog. Work items own
precise work and implementation state. Core models, ADRs, SSOTs, code, and tests
own durable meaning and behavior. Closeout promotes settled outcomes to those
owners, or records why no change was justified.

Use a Campaign only when uncertainty and coordination span sessions. Use a work
item for a bounded change. Use a bounded series for recurring destinations;
never keep an immortal Campaign.

## Delivery baseline

Copier delivers only the governance template. Personal instructions use a separate
guarded sync and generated receipt; [user instruction maintenance](user-instructions.md)
owns adoption, drift and recovery. Shared skill delivery uses its
source lock and generated installation receipt; [skill maintenance](skill-suite.md)
owns that procedure. A consumer's `.copier-answers.yml`
`_commit` identifies the source revision against which its next reconciliation
starts. Tags name preferred stable checkpoints and release events; they do not
replace the recorded source revision.

## Decisions

- [ADR-0001: Keep authority scoped and promotion explicit](adr/0001-scoped-authority-and-explicit-promotion.md)
- [ADR-0002: Use Campaigns for bounded uncertainty](adr/0002-campaigns-for-bounded-uncertainty.md)
- [ADR-0003: Manage shared cores and seed consumer bindings](adr/0003-managed-cores-and-seeded-bindings.md)

- [ADR-0006: Deliver shared skills separately from governance](adr/0006-shared-skill-delivery.md)
- [ADR-0007: Maintain personal instructions at user scope](adr/0007-personal-user-instructions.md)
