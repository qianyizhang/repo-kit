---
name: governance-sync
version: "2.1.0"
description: >-
  Adopt or update the shared governance kit: run Copier, reconcile repository
  bindings, consolidate the agent symlink layout, and restore local gates.
scope: governance kit adoption and sync skill
status: stable
last_update: 2026-09-11
document_class: artifact
---

# Governance kit sync

The kit owns portable files; Copier propagates them. The repository owns its
bindings. Never let either side silently take the other's authority.

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

## First adoption

1. Start from a clean target so the Copier diff is attributable.
2. Run:

   ```bash
   UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools \
     uvx --from copier==9.17.1 copier copy <kit-source> <target-repo>
   ```

3. Merge `pyproject-doc-governance.toml` into `pyproject.toml`, then delete the
   fragment.
4. Consolidate real agent assets under `.codex/skills/`; run
   `python scripts/bootstrap_agents.py`. It must not overwrite real discovery
   directories.
5. Fill `CLAUDE.md`, `docs/index.md`, the glossary, and required binding files.
   Validate the `explain-layman` binding before using that skill.
6. Run `check_docs.py`, symlink checks, and the repository's full gate.

## Update

1. Require a clean consumer and confirm the source plus recorded `_commit` in
   `.copier-answers.yml`.
2. Run:

   ```bash
   UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools \
     uvx --from copier==9.17.1 copier update
   ```

3. Review by ownership: managed files should match the kit; seeded files must
   retain local meaning. Never fill a missing binding from another consumer.
4. Compare every `_skip_if_exists` path with its seed at the recorded baseline,
   even when Copier reports no conflict. Merge portable structure while
   preserving local models, routes, schema extensions, vocabulary, paths, and
   commands.
5. Reconcile the pyproject fragment if Copier recreates it, then delete it.
6. Run documentation, symlink, and repository gates.

When doctrine changes a lifecycle or closeout default, reconcile the seeded
backlog, navigator, and local evidence/retention bindings explicitly. Managed-file
parity is not enough: check that local instructions and machine readers still
support the resulting lifecycle. Propagating retention rules does not itself
authorize deleting consumer records; apply them within the user's cleanup scope.

An `_skip_if_exists` change is a migration, not a routine update. Before
accepting a newly managed path, compare it with the old seed, extract local
authority to its proper binding or local skill, and verify the managed result.

For the explainer binding:

```bash
python .codex/skills/explain-layman/scripts/validate_explainer.py \
  --binding .codex/skills/explain-layman/references/repo-bindings.md \
  --binding-only
```

## Portable candidates

Classify a consumer difference before acting:

- reusable doctrine, workflow, template, check, validator, or visual pattern is
  a repo-kit candidate;
- local vocabulary, architecture, paths, source identity, or policy stays in
  the consumer.

Hand portable candidates to repo-kit's local maintenance workflow with the
source commit and evidence. This consumer skill does not authorize kit commits,
tags, releases, or propagation.

## Pitfalls

- **Dirty consumer:** unrelated changes make ownership review unreliable.
- **Managed core edited locally:** promote the reusable change or create a
  distinctly local skill before updating.
- **Binding schema changed:** skipped files need an explicit semantic migration.
- **Real discovery directories:** consolidate them before bootstrapping symlinks.
- **Missing `.copier-answers.yml`:** there is no safe update baseline.
