---
description: Rules for documentation, glossaries, and durable backlog-item records.
scope: documentation rules
status: stable
last_update: 2026-07-10
---

## general
all docs (including this file) should start with a meta with: `description` (very concise), `scope`, `status` (experimental/stable/deprecated), `last_update`
- transcript/control trailer tokens such as `</content>` and `</invoke>` must never appear as standalone committed doc lines
- `docs/design/` holds **active, forward-looking** design only — specs for work
  not yet landed, plus living architecture docs still maintained as SSOT for
  their area
- standalone ledgers / operating records live in `docs/reports/`, never
  `docs/design/`; the implementation ledger for a backlog item lives directly
  in that item's durable record under `docs/todo/items/`
- deprecated docs live under `docs/deprecated/`; keep their frontmatter
  `status: deprecated`, add an explicit supersession note, and link to the
  active SSOT before moving them there
- deprecated docs are **skim-only historical context**: open them only to recover
  *why* a decision was made. They are never an SSOT and never implementation
  authority; active docs may cite them only as reference-only history
- specs follow a lifecycle: a spec in `docs/design/` is forward-looking only —
  once its slice lands, promote durable contracts to their SSOT (module README /
  index / glossary / prd / backlog) and move the spec to `docs/deprecated/`.
  A spec is **never** the long-term SSOT for landed code

## backlog items

- `docs/todo/backlog.md` is the lifecycle/schema navigator; it does not duplicate
  item status. Each work item is one durable file under `docs/todo/items/`, named
  `<WORK-ID>-<slug>.md`, and stays at that path after closure.
- Backlog files use normal document frontmatter plus `work_id`, `work_status`,
  `added`, `tags`, `depends_on`, `residual_of`, and `residual_items`. Canonical
  work statuses are `deferred`, `ready`, `wip`, `blocked`, `done`, `partial`, and
  `canceled`.
- `partial` is terminal, not another spelling of `wip`: record what landed and
  why the original acceptance criteria did not, then create and link one or more
  residual items. Do not later relabel the original item `done`.
- Every item has a terse append-only **Status History** and a substantive
  append-only **Implementation Ledger**. Status History records each transition;
  the ledger records only material `finding`, `decision`, `assumption`,
  `deviation`, `verification`, and `handoff` events.
- Ledger events state context/evidence, consequence, follow-up, and review state:
  `not-required`, `pending`, `ratified`, `rejected`, `superseded`, or
  `audit-requested`. Promote a settled durable contract to its owning SSOT or ADR
  and link it; the backlog item is not a shadow architecture authority.
- An implementation task names one primary backlog-item path. Before changing
  implementation surfaces, transition it to `wip`; at each material checkpoint
  and stop condition, update the same item. Temporary worker/run ledgers are
  allowed for parallel execution, but the integrator distills their durable
  findings and decisions into the primary item.

## glossary
- meant to be read by human readers who does NOT familiar with this project
- audience is chinese; but keep the term as english
- can have some general explaination section
- should organize into semantic groups of tables
    - Term, Full form, 中文, 中文解释
    - obiously, DDD should have organzied with BC
