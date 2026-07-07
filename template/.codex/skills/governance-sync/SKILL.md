---
name: governance-sync
version: "1.0.0"
description: >-
  Adopt or update the shared governance kit in a repo: run copier for
  deterministic file propagation, then reconcile what copier can't — merge the
  pyproject bindings, consolidate duplicated agent-skill copies into the .codex
  symlink layout, fill CLAUDE.md bindings, and get check_docs green. Use when
  adopting the kit into a new/brownfield repo or pulling a kit update.
scope: governance kit adoption & sync skill
status: stable
last_update: 2026-07-07
---

# Governance kit sync

Deterministic file propagation is copier's job; **semantic reconciliation is
yours**. The split: copier owns versioned kit-file propagation (`docs/rules/*`,
`scripts/check_docs.py`, `scripts/bootstrap_agents.py`, `ruff_base.toml`,
`AGENTS.md`); the agent owns brownfield merge — pyproject bindings, consolidating
duplicated skill copies, filling repo bindings, and closing the lint gap.

Role split: **copier writes files; the agent makes judgment calls** (which
duplicated copy is authoritative, what the repo's real code dirs are, what the
governing invariant says). Never let copier clobber a real directory — that's why
`bootstrap_agents.py` fails closed on real paths.

## A. First adoption (brownfield or greenfield)

1. **Snapshot.** Ensure the target repo is a clean git tree (`git status`), so the
   copier diff is reviewable. Commit or stash first.

2. **Run copier** from the kit source (a local path or git URL):

   ```bash
   uvx copier copy <kit-source> <target-repo>       # e.g. ~/pkgs/repo-kit  .
   ```

   Answer the prompts (`project_name`, `project_slug`, `project_tagline`,
   `code_dirs`). This writes kit-owned files verbatim and seeds the repo-owned
   ones (`CLAUDE.md`, `docs/index.md`, backlog, glossary, `doc-hygiene-audit` +
   this skill). It records answers in `.copier-answers.yml` — commit that file;
   it's what makes later `copier update` work.

3. **Merge the pyproject block.** Copier drops `pyproject-doc-governance.toml`.
   Merge its `[tool.doc_governance]`, `[tool.doc_governance.symlinks]`, and
   `[tool.ruff] extend = "ruff_base.toml"` into the repo's real `pyproject.toml`,
   then delete the dropped file. Tune `repo_path_dirs`, `authority_files`,
   `authority_globs`, and `index_required_globs` to the repo's actual layout.

4. **Consolidate the agent-skill layout.** If the repo already has duplicated
   real `.agents/` and `.claude/skills/` copies (the common brownfield state):
   - pick the authoritative copy and move its skills into `.codex/skills/`;
   - delete the now-empty real `.agents` / `.claude/skills` directories
     (resolve targets first — never `rm -rf` through a symlink);
   - run `python scripts/bootstrap_agents.py` to create the relative symlinks.
     It fails closed if a real dir still sits where a link belongs — that means
     step-one consolidation isn't done.

5. **Frontmatter + bindings.** Add `description/scope/status/last_update`
   frontmatter to every governed doc (`docs/rules/*` already have it). Any
   pre-existing repo docs the index must cover need frontmatter too. Fill the
   `<!-- Fill in -->` binding sections in `CLAUDE.md` (governing invariant,
   architecture rules, commands) and add an `docs/index.md` row per doc/skill.
   Give each existing skill manifest a semver `version:`.

6. **Green the gate.** Run `python scripts/check_docs.py` and fix every finding
   (missing frontmatter, index coverage, broken links, symlink layout, skill
   semver). Wire it into `make lint` (or the repo's lint target). Confirm
   `bootstrap_agents.py --check` and `check_docs.py` both exit 0, then commit.

## B. Pulling a kit update

When the kit publishes a project-agnostic refinement:

```bash
uvx copier update           # in the consumer repo; re-reads .copier-answers.yml
```

Copier 3-way-merges kit-owned files and **leaves `_skip_if_exists` seeds alone**.
Review the diff: kit-owned files (`docs/rules/*`, the two scripts, `ruff_base.toml`,
`AGENTS.md`) should update cleanly; a conflict there means someone edited a
kit-owned file locally — move that change upstream to the kit instead. Re-run
`check_docs.py` and, if the symlink map changed, `bootstrap_agents.py`.

## C. Promoting a refinement upstream (the other direction)

A doctrine refinement discovered while working a consumer repo does **not** stay
local. Patch the kit's `template/docs/rules/*` (or the scripts), bump/tag the kit,
then `copier update` the consumers. Binding changes (anything repo-specific) stay
in the consumer's `CLAUDE.md`. This is the housekeeping loop in
`docs/rules/governance.md` "Kit propagation".

## What is kit-owned vs repo-owned

| Kit-owned (overwritten on update) | Repo-owned (seeded once) |
|:--|:--|
| `docs/rules/*.md` | `CLAUDE.md` |
| `scripts/check_docs.py` | `docs/index.md` |
| `scripts/bootstrap_agents.py` | `docs/todo/backlog.md`, `docs/glossary/*` |
| `ruff_base.toml` | seeded skills (`doc-hygiene-audit`, `governance-sync`) |
| `AGENTS.md` | `pyproject.toml` (merge the block once) |

## Pitfalls

- **`bootstrap_agents.py` fails on a real dir.** Intended: it refuses to clobber a
  real `.agents`/`.claude/skills`. Consolidate into `.codex/` by hand first.
- **Editing a kit-owned file locally.** It gets overwritten on the next
  `copier update`. Push the change to the kit instead, or the repo will drift.
- **Forgetting `.copier-answers.yml`.** Without it committed, `copier update` has
  no baseline and can't 3-way-merge.
- **`code_dirs` too narrow.** If a top-level code dir is missing from
  `repo_path_dirs`, backticked paths to it in authority docs won't be validated
  (silent gap), not a hard error.
