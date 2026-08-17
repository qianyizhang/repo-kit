---
name: domain-modeling
version: "1.4.1"
description: >-
  Build and deliberately evolve the project's core models, ubiquitous language,
  and ADRs. Use when work changes cross-cutting concepts or relationships,
  introduces domain vocabulary, records a durable trade-off, or needs a
  model-grounded decision interview.
scope: domain modeling skill
status: stable
last_update: 2026-08-17
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
skill records only what settles.

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
5. Record confusing synonyms in the `_Avoid_` column.

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

Default to one new ADR per session. A second needs explicit user intent and a
genuinely independent stable decision. Never supersede an ADR created in the
same session; revise the proposal instead.

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
