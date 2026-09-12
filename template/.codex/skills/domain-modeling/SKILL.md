---
name: domain-modeling
version: "1.4.3"
description: >-
  Define and record cross-cutting models, canonical domain terms, and
  consequential architectural decisions in their owning authorities. Use when
  accepted meaning needs capture or a proposed change needs model analysis.
scope: domain modeling skill
status: stable
last_update: 2026-09-12
document_class: artifact
---

# Domain Modeling & Architecture Decisions

Use this skill for durable meaning: cross-cutting models, shared vocabulary, and
hard-to-reverse decisions. Keep exploratory conversation in the current work
record until it earns promotion.

A Campaign may coordinate a destination and its uncertainty, but accepted
models, terms, and decisions still promote through this skill to their owning
authorities.

When paired with `grill-with-docs`, the interview sharpens decisions and this
skill records only what settles. Use `show-me` to explain an existing model
without changing it; use `grilling` for unresolved owner choices. This skill
judges model and terminology consistency and records accepted meaning.

## Files

- Core models: concise bindings in `CLAUDE.md` or a dedicated `docs/models.md`.
- Glossaries: `docs/glossary/*.md`, split by concern.
- ADRs: `docs/adr/NNNN-slug.md`, created only when the first ADR is earned.
- Formats and model guidance:
  `references/{ADR-FORMAT.md,GLOSSARY-FORMAT.md,MODEL-NOTATION.md}`.

## Core models

Use a core model only when a concept or relationship governs multiple contracts,
ADRs, or implementation boundaries. Local code structure, a single workflow,
and routine handoffs do not need model ceremony.

Read `references/MODEL-NOTATION.md` completely before introducing or changing a
core model. That reference owns the placement, authority, change-lock, handle,
and notation mechanics; do not restate them in task-specific skills.

## Glossary management

A new domain term introduced in code or documentation must enter the glossary in
the same change after its meaning is accepted.

1. Classify it as a bounded-context, subject-domain, or shared technical term.
2. Open the matching file under `docs/glossary/`.
3. Follow `references/GLOSSARY-FORMAT.md`.
4. Use the code-facing English name plus the reader-audience translation and
   explanation.
5. Record misconceptions in `_Avoid_`; put deliberately superseded forms in the
   optional `Replaced terms` column.

During a decision interview:

1. Name collisions between the existing meaning and the proposed meaning.
2. Propose one canonical term and the aliases to avoid.
3. Test the boundary with concrete repository scenarios.
4. Write the accepted term in the same turn; do not leave it only in chat.

## Architecture Decision Records

Create an ADR only when all three are true:

1. Reversing the choice would have meaningful cost.
2. The choice would be surprising without its rationale.
3. Viable alternatives existed and a real trade-off selected one.

### Process

1. Increment the highest number under `docs/adr/`, starting at `0001`.
2. Create `docs/adr/NNNN-slug.md` with a lowercase hyphenated slug.
3. Follow `references/ADR-FORMAT.md`. Include only facts that determine the
   choice or explain a non-obvious cost. Add `Serves:` only when a core-model
   relationship materially applies.
4. When the first ADR makes `docs/adr/` a real area, route that area from
   `docs/index.md` and synchronize `index_route_areas`; do not list every ADR.
5. Replace repeated rationale with a short local binding and ADR link.
6. Update `CLAUDE.md` only for an agent-critical repository binding.

During interviews, keep one evolving ADR proposal per decision cluster. Restate
the proposed lock, test its scope and consequences, list remaining uncertainty,
and let the user review the compact wording.

Keep one ADR per independent consequential decision, regardless of session
boundaries. Revise a proposed ADR as the decision evolves. When an accepted
decision changes, record the newly accepted choice in a superseding ADR and
link the old record; preserve its original rationale.

## Pitfalls

- **ADR bloat:** Skip reversible, standard, or non-trade-off choices.
- **ADR echo:** Keep the durable why in one ADR; local docs carry only their
  contract and the link.
- **Glossary skew:** Use accepted glossary terms in code and documentation.
- **Changelog ADRs:** Accepted ADRs are immutable except for status links to a
  later superseding ADR.
- **Model drift:** Never hide a cross-cutting model change inside a feature.
- **Model inventory:** A package tree, stack list, or roadmap is not a core
  model.
