---
description: Rules for documentation, glossaries, and durable work-item records.
scope: documentation rules
status: stable
last_update: 2026-08-17
document_class: coordination
---

# Documentation rules

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

A report is warranted only for a durable finding, decision, or measurement
worth citing. It declares one outcome: `promoted`, `inconclusive`, or
`archive_eligible`. An inconclusive report names its reason and review trigger;
an archive-eligible report names its Archive ID and promoted destinations.

`docs/design/` holds active forward design. When a slice lands, promote durable
contracts to their owning code, contract, README, ADR, glossary, or backlog, then
move the superseded design to `docs/deprecated/`. Deprecated docs use
`status: deprecated`, name the active authority, and remain reference-only
history rather than implementation authority.

## Work-item records

`records/work-items/backlog.md` is the repository-owned lifecycle and schema.
Each active or not-yet-archived item has one file under
`records/work-items/items/`; status and ledger history live only in that file.

Create a work record when coordination must cross a session boundary or carry a
durable decision, deviation, residual, verification, or handoff. A completed
self-contained task needs verification, not a ceremonial record. Promote
settled contracts and decisions to their owning authority and link back; a work
record must not become a shadow architecture source.

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
