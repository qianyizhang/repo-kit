---
name: governance-sync
version: "2.2.0"
description: >-
  Adopt or update the shared governance kit: run Copier, reconcile repository
  bindings, consolidate the agent symlink layout, and restore local gates.
scope: governance kit adoption and sync skill
status: stable
last_update: 2026-09-12
document_class: artifact
---

# Governance kit sync

Adopt or reconcile the portable kit while preserving repository-owned meaning.
Kit files and consumer bindings retain their distinct authority. Reuse existing
authorization for the named kit change and consumer; this skill does not grant it.

## Ownership

| Kit-managed on update | Repository-owned after first copy |
|:--|:--|
| `docs/rules/*`, checks, bootstrap script, `ruff_base.toml`, `AGENTS.md` | `CLAUDE.md`, navigator, backlog, glossary |
| Shared `.codex/skills/**` cores, assets, references, and metadata | Merged `pyproject.toml` configuration |
| Every path not listed in Copier `_skip_if_exists` | Exact `_skip_if_exists` paths, including explainer bindings |

Keep local vocabulary, paths, commands, architecture, and policy in repository
authorities or explicit binding files. A workflow change belongs in repo-kit; a
truly local workflow is a separately named local skill, not an edit to a managed
core.

## Select the operation

- First adoption: read [adoption](references/adoption.md).
- Full update: read [update](references/update.md). Copier changes require a
  clean consumer or an isolated checkout so the diff is attributable.
- Authorized selective reconciliation: inspect the source revision, recorded
  baseline, and exact affected paths. Promote committed portable consumer
  refinements before replacing managed cores. Compare skipped bindings affected
  by the change; preserve unrelated dirt and newer local behavior. Retain the
  recorded full-kit baseline and identify the selectively applied source revision.
  An ownership-path migration still requires the update reference.

## Portable candidates

Classify a consumer difference before acting:

- reusable doctrine, workflow, template, check, validator, or visual pattern is
  a repo-kit candidate;
- local vocabulary, architecture, paths, source identity, or policy stays in
  the consumer.

Hand portable candidates to repo-kit's local maintenance workflow with the
source commit and evidence. This consumer skill does not authorize kit commits,
tags, releases, or propagation.

## Completion

The selected managed files match the reviewed kit revision, affected local bindings
retain their meaning, and applicable documentation, symlink, and integration
checks pass. Report the source revision, scope, omissions, and remaining conflicts.
The agent judges semantic reconciliation; deterministic checks establish structure.
