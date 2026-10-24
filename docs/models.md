---
description: Core concepts and relationships governing repo-kit's evolution and distribution.
scope: repo-kit core model
status: stable
last_update: 2026-10-24
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
| **Personal instructions** | Core and guides in `user/`, explicitly synced to Codex. | This user; repositories retain project-specific authority. |
| **Shared skills** | Skills in `skills/`, pinned by `skills-lock.json` and installed at user scope. | Repo-kit owns selection, declared adaptations, local skills and delivery; the lock retains upstream provenance. |
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

The former ADR-0001–0007 records are condensed here. This table keeps the
accepted trade-offs; linked owners define current procedures.

| Decision | Reason and current owner |
| --- | --- |
| **Scoped authority** · 17 August | Newer or copied evidence does not overrule the concern's owner. Promotion and consumer propagation remain explicit, separate actions. See the product boundary above. |
| **Bounded Campaigns** · 17 August | Work items alone cannot represent changing uncertainty across sessions. A Campaign links existing work rather than adding a tracker, schema or authority. Adapted from Wayfinder; [upstream attribution](../.codex/skills/maintain-repo-kit/references/upstreams.md#mattpocockskills). |
| **Managed doctrine, local bindings** · 17 August | Managing everything would overwrite local meaning; seeding everything would leave shared fixes stranded. Copier owns portable governance; `_skip_if_exists` owns the seed list. A recorded commit is a valid baseline without a release tag. |
| **Finite artifact retention** · 11 September, revised 24 October | Blanket archival preserves spent reporting. Age alone does not release explicit obligations. [Artifact rules](../user/practices/artifacts.md) now require major-outcome bundles and removal of spent evidence after useful decisions are promoted. Required contracts can expose code defects; code does not automatically overrule them. |
| **Current claims, conditional recovery records** · 21 September | Current ownership uses one mutable claim table; material implementation history stays in its work record. Durable output is needed for implementation or independent continuation, not every short read-only lookup. See [coordination terms](../template/docs/rules/agentic-glossary.md#coordination). |
| **Shared skills outside Copier** · 14 October, revised 23 October | One guarded user installation avoids per-repo copies and decouples skill updates from governance migrations. [Skill maintenance](skill-suite.md) and the lock own selection, upstream provenance and declared entrypoint adaptations. This replaces the former Copier skill-delivery decision; metadata/licenses and consumer-specific meaning remain protected. Teams choosing repo-scoped delivery must avoid competing discovery names. |
| **Personal instructions outside Copier** · 22 October | One versioned source avoids copied defaults. [Instruction maintenance](user-instructions.md) owns explicit guarded sync and recovery; `AGENTS.md` is canonical, Claude files are pointers, and project contracts remain local. Personal macOS defaults are not mandatory for other kit users. There is no reverse sync or background updater. |

Older consumers still require the [migration handoff](../.codex/skills/maintain-repo-kit/references/migration-handoff.md).
For new significant trade-offs, use the existing owner when a compact decision
fits; create a separate ADR only when its rationale needs a distinct document.
