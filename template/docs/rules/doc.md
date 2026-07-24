---
description: Rules for documentation, glossaries, and durable backlog-item records.
scope: documentation rules
status: stable
last_update: 2026-07-15
document_class: coordination
---

## general
all governed Markdown (including this file) starts with `description` (very
concise), `scope`, `status` (experimental/stable/deprecated), `last_update`, and
one declared `document_class`.

Portable classes are `coordination`, `work_record`, `report`, `source`,
`artifact`, `generated`, and `tombstone`. Repositories configure each class's
required fields and allowed locations under
`[tool.doc_governance.document_classes]`. Unknown classes, missing profile
fields, and class/location mismatches fail closed. A class does not transfer
authority: the owning SSOT, source bytes, Work Record, or machine artifact stays
authoritative for its concern.

## coordination spine

- `docs/` is the compact Coordination Spine, not the complete readable corpus.
  Keep current product/domain authority, ADRs, glossary, rules, guides,
  reference syntheses, and active forward design there.
- Work Records live under `records/work-items/`; reports under
  `records/reports/`; faithful payloads under `sources/`; generated outputs in
  their configured artifact area.
- `docs/index.md` routes areas and concepts. It does not enumerate every file.
  Complete discovery belongs to deterministic, disposable Human View.
- Task Context includes only explicit paths or declared sections, each with a
  reason and digest. Human View and Task Context are projections, never edit
  targets or independent authorities.
- A report is warranted for a **durable finding, decision, or measurement worth
  citing later** — not a routine run. Transient run notes live in the work-item
  ledger or the run's own digest, not a fresh dated report.
- Reports declare exactly one outcome: `promoted`, `inconclusive`, or
  `archive_eligible`. An inconclusive report names its reason and review
  trigger. An archive-eligible report names its Archive ID and promoted
  destinations; terminal status or age alone is insufficient.
- transcript/control trailer tokens such as `</content>` and `</invoke>` must never appear as standalone committed doc lines
- `docs/design/` holds **active, forward-looking** design only — specs for work
  not yet landed, plus living architecture docs still maintained as SSOT for
  their area
- standalone ledgers / operating records live in `records/reports/`, never
  `docs/design/`; the implementation ledger for a backlog item lives directly
  in that item's durable record under `records/work-items/items/`
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

- `records/work-items/backlog.md` is the lifecycle/schema navigator; it does not
  duplicate item status. Each active or not-yet-archived work item is one durable
  file under `records/work-items/items/`, named `<WORK-ID>-<slug>.md`.
- Backlog files use normal document frontmatter plus `work_id`, `work_status`,
  `work_kind`, `added`, `tags`, `depends_on`, `residual_of`, and `residual_items`.
  Canonical work kinds are `decision`, `build`, and `research`. Canonical work
  statuses are `deferred`, `ready`, `wip`, `blocked`, `done`, `partial`, and
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
- A work-item is warranted only when work **crosses a session boundary** — it
  spans sessions, is left `partial`/`blocked`, or carries decisions/deviations/residual
  worth transferring. A self-contained one-off finished in-session leaves no item.
- When one is warranted it names one primary backlog-item path. Before changing
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
