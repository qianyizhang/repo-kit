# repo-kit — shared governance kit

A [copier](https://copier.readthedocs.io/) template for the portable
repo-governance layer used across `~/pkgs/*`: doctrine docs, mechanical doc/style
checks, the agent-toolchain symlink layout, and the two hygiene skills.

Copier (not cookiecutter) so that a doctrine refinement propagates to every
consumer with `copier update`, not a one-time scaffold.

## What it ships

**Kit-owned** (overwritten on `copier update`):

- `docs/rules/{governance,doc,python,skill,skill-glossary,testing}.md` —
  portable doctrine (skill glossary defines bold terms in `skill.md`).
- `scripts/check_docs.py` — mechanical doc governance (reads
  `pyproject.toml [tool.doc_governance]`); backlog items require `work_kind`
  in `{decision, build, research}`.
- `scripts/bootstrap_agents.py` — creates/repairs the `.codex` symlink layout,
  fails closed on real dirs.
- `ruff_base.toml` — ruff doctrine defaults.
- `AGENTS.md` — thin pointer to `CLAUDE.md`.
- `governance-sync` — the portable adoption/update/reconciliation procedure.
- `grilling` — shared model-invoked decision-interview primitive.
- `explain-layman` core workflow, references, assets, validator, and UI metadata.

**Seeded once, then repo-owned** (`_skip_if_exists`):

- `CLAUDE.md`, `docs/index.md`, `records/work-items/backlog.md`, `docs/glossary/ddd.md`
  (jinja skeletons with the repo's bindings).
- Seeded skills under `.codex/skills/`: `doc-hygiene-audit`, `domain-modeling`,
  `glossary-drill`, `grill-with-docs`, and `show-gap`.
- `.codex/skills/explain-layman/references/repo-bindings.md` — the consumer's
  audience, authority, vocabulary, paths, source identity, and verification
  profile.
- `pyproject-doc-governance.toml` — a block to merge into the repo's real
  `pyproject.toml`, then delete.

## Use it

Adoption and updates are driven by the managed **`governance-sync`** skill
(`template/.codex/skills/governance-sync/SKILL.md`) — it wraps the raw copier
commands with the semantic reconciliation copier can't do (pyproject merge,
consolidating duplicated skill copies, filling bindings, greening `check_docs`).

```bash
# first adoption
uvx copier copy ~/pkgs/repo-kit <target-repo>
# later, pull a kit update
cd <target-repo> && uvx copier update
```

## Layout

```
copier.yml                 # questions + _skip_if_exists + after-copy message
template/                  # the payload (_subdirectory), *.jinja files are rendered
  AGENTS.md
  ruff_base.toml
  pyproject-doc-governance.toml.jinja
  scripts/{check_docs,bootstrap_agents}.py
  docs/rules/*.md
  docs/{index.md,glossary/ddd.md}.jinja
  records/work-items/backlog.md.jinja
  CLAUDE.md.jinja
  .codex/skills/{doc-hygiene-audit,governance-sync,domain-modeling,glossary-drill,grilling,grill-with-docs,show-gap,explain-layman}/
```

The doctrine itself explains the propagation model — see
`template/docs/rules/governance.md` "Kit propagation".
