---
description: Repo-local constitution for evolving and distributing the shared governance kit.
scope: repo-kit governance
status: stable
last_update: 2026-10-14
document_class: coordination
---

# Repo-kit constitution

Repo-kit owns a shared skill bundle and a portable governance template.
Skills use the standalone installer; governance uses Copier.
This file governs repo-kit itself; it is not exported to consumers.

## Model and decisions

The shared skill bundle and governance template have separate delivery.
Candidate evidence can be promoted to either product; project-specific consumer
bindings retain their own authority. The [core model](docs/models.md) and
[ADRs](docs/adr/) explain those relationships and optional Campaign coordination.

> Information may cross boundaries freely. Authority crosses only through an
> explicit decision by the owner.

- A downstream delta or copied upstream idea is only a Candidate.
- A Campaign links work, evidence, and decisions; it owns none of them.
- Promotion means recreating the smallest justified change in `skills/` or
  `template/` and approving it explicitly.
- Copier describes delivery. The consumer's recorded `_commit` is its baseline;
  a tag is a preferred checkpoint, not a second source of truth.

Root governance and `maintain-repo-kit` stay local. `skills/` and
`skills-lock.json` own the shared skill product. `template/` owns the separate
Copier governance product; `copier.yml` declares its delivery and ownership paths.
Read [skill maintenance](docs/skill-suite.md) for the review and sync commands.

Keep executable truth in code, tests, schemas, or configuration; current
cross-surface contracts in their owner; and durable trade-off rationale in ADRs.
Indexes and explanations are projections unless explicitly promoted.

## Operating rules

- Use `.codex/skills/maintain-repo-kit/` before topology, upstream, downstream,
  checkpoint, or propagation work.
- Inspect exact commits and diffs. Never promote a dirty consumer snapshot.
- Preserve upstream provenance and consumer-specific meaning.
- Keep unrelated dirty work intact.
- Promotion, merges, rebases, deletion, worktree removal, tagging, pushing, and
  consumer propagation require explicit approval for that action class.

## Verification

Repo-kit stays manifest-free. Use Python 3.12 and pinned ephemeral tools:

```bash
python3.12 scripts/skills.py check --source-only
python3.12 -m unittest discover -s tests -v
UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools uvx --from ruff==0.16.3 ruff format --check --config template/ruff_base.toml scripts template/scripts tests .codex/skills/maintain-repo-kit/scripts
UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools uvx --from ruff==0.16.3 ruff check --config template/ruff_base.toml scripts template/scripts tests .codex/skills/maintain-repo-kit/scripts
```

For governance delivery changes, run the opt-in Copier smoke test against a
reviewed candidate index with `REPO_KIT_COPIER_SMOKE=1`. Preserve unrelated staged
work; use a disposable candidate checkout when needed. Shared skills are tested
through their standalone installer, not Copier.

## Finishing a slice

Use the shared `finish-work` skill for review and scoped commits. This constitution
owns promotion authority; [skill maintenance](docs/skill-suite.md) owns bundle
verification and installation. Keep consumer bindings and Copier delivery separate.
