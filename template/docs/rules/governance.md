---
description: Portable doctrine for scoped authority, core models, toolchain layout, and governance propagation.
scope: repo governance rules
status: stable
last_update: 2026-08-17
document_class: coordination
---

# Governance rules

This file contains portable governance doctrine. Project identity, invariants,
commands, architecture, vocabulary, and core-model instances remain repository
bindings.

## Doctrine and bindings

- **Doctrine** is a practice that transfers across repositories of this shape.
  It lives once under `docs/rules/`.
- **Binding** is what is true of one repository. Its entry point is `CLAUDE.md`,
  which links to lower owning contracts, schemas, ADRs, glossaries, and code.
- Project-agnostic refinements are promoted to the kit. Repository facts stay in
  their owning binding. Copying either into the other creates drift.

## Scoped authority and core models

One meaning lives once, at the lowest level that fully owns it:

- executable behavior belongs in code, tests, schemas, or configuration;
- a cross-shard contract belongs in its owning contract, schema, or API;
- an ADR owns the durable reason for a significant trade-off;
- the glossary owns canonical domain terms;
- a core model owns the few relationships that govern several contracts or
  decisions.

Authority is scoped by concern, not by one global file ranking. When sources
appear to conflict, identify the concern and abstraction level, then repair the
stale source.

A repository states its core model in `CLAUDE.md` or `docs/models.md`. Use
[`MODEL-NOTATION.md`](../../.codex/skills/domain-modeling/references/MODEL-NOTATION.md)
for durable model shapes and update mechanics. A core-model change requires an
explicit before/after model, evidence, affected authorities, and a decision lock;
it must not arrive as an unnoticed feature side effect.

`docs/index.md` is a thin navigator and the human-facing flow map. It routes
authority areas without copying their contents or enumerating operating records.
Documentation classes and lifecycle belong to `docs/rules/doc.md`.

Diagrams, generated views, explainers, and interactive artifacts are
projections. Convenience does not make them authoritative. The glossary owns
domain language; `docs/rules/authoring.md` owns portable prose guidance.

## Campaigns

A Campaign is an optional, bounded coordination record for a durable,
multi-session destination whose uncertainty or learning cannot be represented
honestly as one precise work item. During the pilot it is advisory: use one
page under `records/campaigns/`, not a new tracker or authority layer.

- The Campaign holds the destination, known uncertainty, current frontier, and
  links to work, evidence, learning, and decisions.
- Work items own precise decision, research, and build work plus implementation
  state.
- Core models, ADRs, SSOTs, and executable contracts own durable outcomes.

Do not create a Campaign for a self-contained task, use it as a duplicate store
or immortal backlog, or leave settled meaning inside it. Close it by promoting
durable outcomes to their owners. `docs/rules/doc.md` defines the minimal record
shape.

## Agent toolchains and symlinks

Toolchains share agent assets by symlink, not copy:

```text
CLAUDE.md                 # repository binding and agent entry point
AGENTS.md                 # thin pointer to CLAUDE.md
.codex/                   # canonical shared agent assets
  ├── agents/
  └── skills/
.agents   ->  .codex
.claude/
  ├── settings.json
  └── skills  ->  ../.codex/skills
```

- `.codex/` holds the real assets. `.agents` and `.claude/skills` are relative
  symlinks into it; never maintain per-toolchain copies.
- Resolve a symlink before deletion or bulk file operations near it.
- `[tool.doc_governance.symlinks]` declares the expected map.
  `scripts/bootstrap_agents.py` creates or repairs links and fails closed when a
  real directory occupies a link path.

## Mechanical enforcement

Portable scripts read repository-owned bindings from `pyproject.toml`:

- `scripts/check_docs.py` checks frontmatter classes and locations, deprecated
  status, links and repository paths, index routes, skill invocation metadata,
  work-item identity and lifecycle, and the symlink map.
- `scripts/check_authoring.py` reports profile-scoped terminology and prose
  findings. It never edits text or becomes another vocabulary authority.
- Import contracts enforce architecture; Ruff enforces the shared style
  baseline plus repository exceptions.

Stable structural invariants belong in deterministic checks. Repository-specific
language and enforcement policy stay in configuration. Semantic contradictions
and stale meaning require evidence-based review rather than another heuristic
gate.

## Context hygiene

- Keep decision, fit, and slice packaging in one continuous context until a
  durable handoff exists.
- Prefer a fresh context per implementation item, starting from its work record
  rather than chat memory.
- Before a tool switch, long-thread cutoff, or degraded context, write a session
  handoff.
- Parallel writers use one claim ledger and one owner per surface; a single
  writer needs only the handoff record.

## Kit propagation

`template/` is the portable product. External ideas and downstream corrections
enter as candidates; only explicit promotion changes that product. A consumer's
recorded Copier `_commit` is its reconciliation baseline. Tags are preferred
stable checkpoints and release events, not the sole transfer authority.

Copier ownership is path-based:

- paths absent from `_skip_if_exists` are kit-managed and may be replaced on
  update, including shared skill cores;
- paths listed in `_skip_if_exists` are seeded once and then repository-owned,
  including local bindings;
- the exact `_skip_if_exists` list is the ownership declaration.

Recreate a portable downstream correction minimally in the template. Never copy
one consumer's vocabulary, paths, source identity, verification commands, or
dirty working tree into another consumer. After selecting a new kit revision,
reconcile seeded bindings deliberately and validate the managed result in each
consumer.
