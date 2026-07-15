---
name: domain-modeling
version: "1.1.0"
description: >-
  Build and sharpen the project's domain model: keep glossary files updated with
  ubiquitous language, record architectural decisions as sequential ADR files,
  verify naming consistency, or run a grill-with-docs decision interview. Run
  when introducing new concepts, naming policy, or significant architectural
  decisions.
scope: domain modeling skill
status: stable
last_update: 2026-07-07
document_class: artifact
---

# Domain Modeling & Architecture Decisions

> Seeded from the governance kit. Sharpen the glossary layout, ADR examples, and
> classification axes for your repo on the first run; those edits are repo-owned.

This playbook governs how we define, evolve, and document the project's
ubiquitous language (glossaries) and durable design choices (Architecture
Decision Records, or ADRs).

Active domain modeling prevents "vibe coding" and software entropy. We record
decisions *as they crystallize* instead of letting them dissolve into code
comments or rot in long documentation headers.

When paired with `grill-with-docs`, this skill is the documentation hand: the
interview asks one decision at a time, while this skill updates glossary entries
and ADRs as terms and trade-offs settle.

## File Layout

Two main forms of domain documentation:

1. **Glossaries** (`docs/glossary/*.md`): Define cross-cutting terminology.
   Follows the Ubiquitous Language invariant (`CLAUDE.md` §Architecture rules).
   Split by concern — a `ddd.md` grouped by Bounded Context, plus any
   domain-specific glossaries the repo needs (e.g. a technical-framework file, or
   a subject-matter file).
2. **Architecture Decision Records (ADRs)** (`docs/adr/NNNN-slug.md`): Record
   significant, hard-to-reverse design decisions.

```
/
├── docs/
│   ├── glossary/
│   │   └── ddd.md                   ← + repo-specific glossaries as needed
│   └── adr/                          ← Lazily created when the first ADR is written
│       └── 0001-<slug>.md
└── .codex/skills/domain-modeling/
    ├── SKILL.md
    └── references/{ADR-FORMAT.md, GLOSSARY-FORMAT.md}
```

Create files lazily: if `docs/adr/` does not exist, initialize it only when the
first ADR is written.

## 1. Glossary Management (Ubiquitous Language)

A new domain term introduced in code (class names, table columns, fields, API
paths) or in documentation MUST be added to the glossary in the same change.

### Process
1. Classify the term: is it a DDD concept (bound to a specific Bounded Context),
   a subject-domain concept, or a shared technical-framework concept? Route it to
   the matching glossary file.
2. Open the corresponding file under `docs/glossary/`.
3. Add the term following the structured table layout in
   `references/GLOSSARY-FORMAT.md`.
4. Write the term in English (matching code), with the reader-audience language
   translation and explanation.
5. Identify synonyms or confusing terms and document them under the `_Avoid_`
   column.

### During decision interviews
1. Challenge overloaded terms immediately: name the existing glossary meaning,
   the user's apparent meaning, and ask which should win.
2. Propose one canonical term when the user uses vague language. Include the
   `_Avoid_` aliases that would otherwise reintroduce ambiguity.
3. Use concrete repo scenarios to test the term boundary before writing it.
4. Once the user accepts the term, update the glossary in the same turn. Do not
   leave accepted vocabulary only in chat.

## 2. Architecture Decision Records (ADRs)

An ADR captures the "why" of a choice, including considered options and
trade-offs.

### When to offer an ADR
All three criteria MUST be met:
1. **Hard to reverse** — Changing your mind later would incur meaningful
   refactoring or operational cost.
2. **Surprising without context** — A future engineer (or agent) would ask "why
   this way instead of the obvious/generic way?"
3. **The result of a real trade-off** — There were viable alternatives, and one
   was selected for specific reasons.

### Process
1. Scan `docs/adr/` for the highest existing number and increment it. If none
   exist, start with `0001`.
2. Create `docs/adr/NNNN-slug.md` using lowercase, hyphen-separated slugs.
3. Write the ADR using `references/ADR-FORMAT.md`. Keep it concise: a single
   paragraph of context, decision, and rationale is often enough.
4. Update the `docs/index.md` navigator to register the new ADR.
5. Replace duplicated decision prose in docs and code comments with a short local
   binding plus an ADR reference. Keep operational details in the owning SSOT;
   don't restate the ADR's context/options/consequences in every file.
6. Update `CLAUDE.md` only when the decision is an agent-critical repo binding;
   otherwise point the owning SSOT or README to the ADR.

### During decision interviews
Ask at most one ADR question at a time. Phrase it as a concrete decision with the
recommended answer, the alternative that remains plausible, and the cost of
changing later. When the user accepts and all three criteria hold, write the ADR
immediately; otherwise record the unresolved question in the owning spec/backlog
rather than manufacturing an ADR.

## Pitfalls

- **ADR Bloat**: Documenting simple, easily-reversible, or standard decisions. If
  it's not a real trade-off or hard to reverse, skip the ADR.
- **ADR Echo**: Copying the same rationale into `CLAUDE.md`, module READMEs, and
  comments. ADRs carry the durable "why"; local docs carry only the local
  contract and link to the ADR.
- **Glossary Skew**: Letting variable names in code diverge from glossary
  definitions. Use the glossary terms exactly as defined.
- **Changelogging in ADRs**: Editing old, accepted ADRs to reflect changes. Once
  accepted, ADRs are immutable. If a decision changes, create
  `NNNN-new-decision.md` (status `accepted`) and set the old ADR's status to
  `superseded by ADR-NNNN`.
