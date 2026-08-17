---
description: Repo-local constitution for evolving and distributing the shared governance kit.
scope: repo-kit governance
status: stable
last_update: 2026-08-17
document_class: coordination
---

# Repo-kit constitution

Repo-kit owns a portable governance product and distributes it with Copier.
This file governs repo-kit itself; it is not exported to consumers.

## Model and decisions

Repo-kit has three product-boundary concepts and one optional coordination lens:
**Candidate** evidence, the intentional `template/` **Portable product**, a
locally owned **Consumer binding**, and a **Campaign** for a bounded destination
under uncertainty. The [core model](docs/models.md) owns their relationships;
[ADRs](docs/adr/) record the durable trade-offs behind them.

> Information may cross boundaries freely. Authority crosses only through an
> explicit decision by the owner.

- A downstream delta or copied upstream idea is only a Candidate.
- A Campaign links work, evidence, and decisions; it owns none of them.
- Promotion means recreating the smallest justified change in `template/` and
  approving it explicitly.
- Copier describes delivery. The consumer's recorded `_commit` is its baseline;
  a tag is a preferred checkpoint, not a second source of truth.

Root governance and `maintain-repo-kit` stay local. `template/` is the portable
product; `copier.yml` declares delivery and ownership paths.

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
python3.12 -m unittest discover -s tests -v
# opt-in networked Copier integration
REPO_KIT_COPIER_SMOKE=1 python3.12 -m unittest tests/test_template_smoke.py -v
UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools uvx --from ruff==0.16.3 ruff format --check --config template/ruff_base.toml template/scripts/check_authoring.py tests
UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools uvx --from ruff==0.16.3 ruff check --config template/ruff_base.toml template/scripts/check_authoring.py tests
```
