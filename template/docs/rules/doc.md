---
description: Rules for documentation, glossaries, and durable work-item records.
scope: documentation rules
status: stable
last_update: 2026-10-24
document_class: coordination
---

# Documentation rules

## Keep what matters

Keep material needed to use the system, explain an accepted decision or invariant,
coordinate unfinished work, or substantiate a claim. Prefer the nearest sufficient
owner: code, schema, configuration, test, local comment, contract, or evidence.
Do not copy knowledge into prose merely because it currently lives in code.

Root and module READMEs orient readers, provide essential usage, and route to
owners. Keep explanations that prevent misuse; omit mirrored field inventories,
defaults, operating status, and result tables already owned elsewhere. Durable
runbooks explain repeatable operations; session notes describe one execution.

## Frontmatter and classes

All governed Markdown starts with concise `description`, `scope`, `status`,
`last_update`, and `document_class` fields. Status is `experimental`, `stable`,
or `deprecated`.

Portable classes are `coordination`, `work_record`, `report`, `source`,
`artifact`, `generated`, and `tombstone`. Repositories configure their required
fields and allowed locations under `[tool.doc_governance.document_classes]`.
Unknown classes, missing fields, and location mismatches fail closed. A class
describes lifecycle; it does not transfer authority from the owning contract,
source bytes, work record, or machine artifact.

## Locations and projections

- `docs/` is the compact coordination spine for current authorities, rules,
  glossary, guides, reference syntheses, and forward design.
- Optional Campaign records live under `records/campaigns/`; work-item records
  under `records/work-items/`; durable reports under `records/reports/`;
  faithful payloads under `sources/`; generated outputs in their configured
  artifact area.
- Session handoffs and claim ledgers are coordination records and may also live
  under `records/reports/`; they do not claim a report outcome.
- `docs/index.md` routes areas and concepts. Generated discovery views are
  disposable projections, not edit targets or independent authorities.
- Standalone ledgers belong in `records/reports/`. A work item's implementation
  ledger stays in its own record.
- Transcript/control trailer tokens such as `</content>` and `</invoke>` must
  never appear as standalone committed lines.

## Lifecycle

A report is warranted only for a major outcome: a durable finding, accepted
decision, release or end-to-end result worth citing. Keep its result, source
revision, check summary, limits and essential supporting files in one bundle.
Its README is the single manifest for outcome, source reference, final validation,
limits and retention; no separate metadata file or per-step/per-file receipts.
Routine logs, screenshots and intermediate receipts stay in the repository's
ignored artifact area. Validate the final result and important failure paths;
checks against historical paperwork are not product behavior tests.

A retained report declares one outcome: `promoted`, `inconclusive`, or
`archive_eligible`. An inconclusive report names its reason and review trigger;
an archive-eligible report names its Archive ID and promoted destinations.

`docs/design/` holds active forward design. When a slice lands, preserve accepted
contracts, rationale, constraints, and residual work in their owners, then remove
the spent plan. Archive it under `docs/deprecated/` only when the historical
document itself remains useful. Deprecated docs use `status: deprecated`, name
the active authority, and remain reference-only history.

At closeout, trim duplicate explanations and delete consumed handoffs, completed
claim ledgers, and promotion receipts with no remaining purpose. Before removal:

- check for active users, unique decisions, unresolved work, and evidence needs;
- preserve required content in its existing owner and repair incoming links,
  work-ID references, catalog registrations, and other machine readers;
- respect source/evidence retention and explicit append-only obligations. Being
  old or complete does not release those explicit obligations. Otherwise delete
  spent bundles at closeout. At maintenance, review leftovers older than 30 days;
  continued retention needs a named active use and next review date.

Keep a compact record where identity, lineage, acceptance evidence, or discovery
still depends on it. Do not move or delete a record beyond its readers' supported
scope as cosmetic cleanup. Git can recover committed prose, not ignored evidence
or uncommitted state. Do not create an archive, tombstone, or audit report merely
to account for every deletion; use one only for a demonstrated remaining need.

## Work-item records

Repo-kit owns the portable lifecycle and schema, enforced by
[`check_docs.py`](../../scripts/check_docs.py). The repository owns its triage
tags, discovery page, and work-item directory. Set `work_items_dir` under
`[tool.doc_governance]` in `pyproject.toml` to a repository-relative directory.
The default is the directory used in the seeded backlog page. Each active or
retained item has one Markdown file directly in that directory. Status and
ledger history live in the item file. After updating an older copy, keep local
tags, paths, and discovery instructions in the backlog page and replace any
copied schema or lifecycle text with a link to this section. Existing
configuration can keep extra local class fields.

Create a work record when coordination must cross a session boundary or carry a
durable decision, deviation, residual, verification, or handoff. A completed
self-contained task needs verification, not a ceremonial record. Promote
settled contracts and decisions to their owning authority and link back; a work
record must not become a shadow architecture source.

Record material findings, decisions, deviations, and verification once. Routine
progress belongs in the execution's existing state or ledger. Retained terminal
items should carry outcome, acceptance evidence, residuals, and links to promoted
owners; trim spent execution prose subject to the preservation rules above.

### Work status and kind

- `deferred`: valid work, deliberately not scheduled.
- `ready`: scope and acceptance criteria are sufficient to begin.
- `wip`: actively owned; implementation has started.
- `blocked`: needs a named decision, dependency, or capability.
- `done`: all acceptance criteria are satisfied and verified.
- `partial`: terminal accepted subset; remaining scope exists as linked items.
- `canceled`: terminal intentional abandonment, with rationale.

Keep `partial` terminal. Close the residual scope through new items linked
with `residual_of` / `residual_items`. The original outcome remains historical.

Canonical `work_kind` values are `decision`, `build`, and `research`.
Names start with the work ID followed by a hyphen, for example
`AB-AREA-001-confirm-fixture.md`. The area uses uppercase letters or digits.
IDs are unique across the work-item directory.

### Record shape

```markdown
---
description: Confirm the fixture meets its contract.
scope: backlog item
status: stable
last_update: 2026-09-11
document_class: work_record
work_id: AB-AREA-001
work_status: deferred
work_kind: build
added: 2026-09-11
tags: tag-a, tag-b
depends_on: none
residual_of: none
residual_items: none
---

# AB-AREA-001 — Confirm the fixture

## Intent

Confirm the fixture behavior.

## Acceptance Criteria

- [ ] Verify the fixture through its public interface.

## Context and Trade-offs

Use the existing fixture to keep the check reproducible.

## Status History

| Date | Actor | From | To | Reason / evidence |
| --- | --- | --- | --- | --- |
| 2026-09-11 | maintainer | — | deferred | Item captured |

## Implementation Ledger

No implementation events yet.
```

Status History is terse and append-only. Implementation Ledger entries are
substantive and use one of `finding`, `decision`, `assumption`, `deviation`,
`verification`, or `handoff`; each records evidence, consequence, follow-up, and
review state (`not-required`, `pending`, `ratified`, `rejected`, `superseded`, or
`audit-requested`).

The checker requires the frontmatter and headings in the example. The final
Status History destination must match `work_status`. Items in `wip`, `blocked`,
`done`, or `partial` require a ledger event. A `done` item has no unchecked
acceptance boxes. Each lineage field is `none` or a comma-separated list of
existing work IDs other than the item's own ID. A `partial` item requires at
least one residual item. Review the history and ledger for meaningful evidence
and preserve their recorded outcomes.

## Campaign records

A Campaign uses the existing `coordination` class and one advisory page at
`records/campaigns/<slug>.md`. Create it only at the threshold defined in
`docs/rules/governance.md`. Keep these headings:

1. Destination
2. Model relationship
3. Current understanding
4. Unknowns
5. Frontier
6. Work
7. Learning ledger
8. Closeout

Link work items and owning authorities instead of copying their state or
meaning. Keep the frontier current as uncertainty clears. At closeout, name the
durable outcomes promoted to core models, ADRs, SSOTs, contracts, or other
owners; do not preserve a Campaign as an immortal backlog.

## Glossary

Glossaries are written for readers who do not already know the repository and
remain the authority for canonical domain vocabulary. The repository owns its
audience language, fields, grouping, and bounded contexts. Authoring checks
consume glossary entries as a projection and never create another vocabulary
authority; see `docs/rules/authoring.md`.
