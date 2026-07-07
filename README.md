# repo-kit — shared governance kit

A [copier](https://copier.readthedocs.io/) template for the portable
repo-governance layer used across `~/pkgs/*`: doctrine docs, mechanical doc/style
checks, the agent-toolchain symlink layout, and the two hygiene skills.

Copier (not cookiecutter) so that a doctrine refinement propagates to every
consumer with `copier update`, not a one-time scaffold.

## What it ships

**Kit-owned** (overwritten on `copier update`):

- `docs/rules/{governance,doc,python,skill,testing}.md` — portable doctrine.
- `scripts/check_docs.py` — mechanical doc governance (reads
  `pyproject.toml [tool.doc_governance]`).
- `scripts/bootstrap_agents.py` — creates/repairs the `.codex` symlink layout,
  fails closed on real dirs.
- `ruff_base.toml` — ruff doctrine defaults.
- `AGENTS.md` — thin pointer to `CLAUDE.md`.

**Seeded once, then repo-owned** (`_skip_if_exists`):

- `CLAUDE.md`, `docs/index.md`, `docs/todo/backlog.md`, `docs/glossary/ddd.md`
  (jinja skeletons with the repo's bindings).
- Seeded skills under `.codex/skills/`: `doc-hygiene-audit`, `governance-sync`,
  `domain-modeling`, `grill-with-docs`, `show-gap`, `explain-layman` (the last
  four are portable seeds — sharpen them with repo-specific terms on first use).
- `pyproject-doc-governance.toml` — a block to merge into the repo's real
  `pyproject.toml`, then delete.

## Use it

Adoption and updates are driven by the seeded **`governance-sync`** skill
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
  docs/{index.md,todo/backlog.md,glossary/ddd.md}.jinja
  CLAUDE.md.jinja
  .codex/skills/{doc-hygiene-audit,governance-sync,domain-modeling,grill-with-docs,show-gap,explain-layman}/
```

The doctrine itself explains the propagation model — see
`template/docs/rules/governance.md` "Kit propagation".
