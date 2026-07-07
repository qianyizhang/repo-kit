---
name: explain-layman
version: "1.6.1"
description: >-
  Create plain-language stakeholder explainers for a repo concept — typically a
  standalone HTML page under docs/background/ — translating domain/product/system
  boundaries without weakening the repo's safety, review, provenance, or authority
  contracts. Use when asked to explain a repo concept to non-technical people or
  produce stakeholder communication.
scope: stakeholder explainer skill
status: stable
last_update: 2026-07-07
---

# Explain Layman

> Seeded from the governance kit. Fill in the repo's non-negotiable boundaries,
> canonical object names, and word-choice tables on the first run; those edits are
> repo-owned.

Turn a repo concept into a non-technical stakeholder artifact — usually a polished
standalone HTML page under `docs/background/`.

## Grounding order

Before writing, read enough live repo authority to avoid weakening contracts:

1. `CLAUDE.md` for the governing invariant and doc rules.
2. `docs/index.md` for the audience map and where this topic belongs — never
   memory for volatile module status.
3. The topic's SSOT (the owning ADR / module README / design doc routed from the
   index).
4. `references/style-guide.md` — the style SSOT for these pages: editorial
   posture, page rhythm, tone, word-choice discipline, visual and
   interactive-visual patterns, the role/scale/honest-omission moves, the schema
   field-card widget, and reusable blocks.
5. One nearby explainer for comparison (an existing `docs/background/*` page).

## Non-negotiable boundaries

A plain-language page must never weaken a contract the repo declares. Before
writing, list the repo's authority/safety boundaries (from `CLAUDE.md`'s governing
invariant) and preserve each one when relevant. Typical shapes to preserve:

- Who owns the human gate vs. what an agent/LLM only proposes.
- Which object is the canonical source of truth vs. which are renderings/previews.
- What a deterministic backbone computes with no LLM in the path.
- Which users may view but not act (permission role ≠ real-world responsibility —
  do not collapse them).
- What becomes a review prompt rather than a direct instruction.
- That approved artifacts are immutable; changes create new versions.
- That every claim is source-backed and reviewable.

> Fill in the concrete list for this repo here on first run — the generic shapes
> above are prompts, not the contract.

## Writing the page

- Default artifact language is the repo's stakeholder-reader language; canonical
  source-object names and real schema field names stay in English (matching code).
  Canonical translations for domain nouns come from `docs/glossary/`, never
  invented per page.
- Write one concrete boundary per page. Good topics answer one practical
  confusion: "What is this concept, and what is it not?" · "Who owns which
  responsibility?" · "What can be automated, and what requires human review?" ·
  "How does a source/version/fact become a visible work item?" · "Why is this
  workflow longer than just asking an LLM?"
- Output standalone dependency-free HTML unless the user asks for Markdown,
  following the style guide's page rhythm, section patterns, tone, and visual
  constraints. When the concept is an object or generated artifact, lead with a
  concrete mock artifact surface before definition cards.
- Run a dedicated **word-choice pass** before finishing — it is a mandatory step,
  not polish. Bare jargon and literal calques are the most common quality
  regression; the repo's fix tables live in the style guide's word-choice section.
- Stamp at creation: a frontmatter-equivalent HTML comment with `description`,
  `scope`, `status`, `last_update`, and `produced_by` —
  `explain-layman@<version> · agent=<model-id> · effort=<level> · <date>`. Older
  unstamped pages are not backfilled with invented provenance; they get stamped at
  their next substantive edit.

## Update repo navigation

For a new maintained background page:

1. Put it under `docs/background/<slug>.html`. The filename is a concise slug of
   the page `<title>` / H1, not an unrelated implementation label.
2. Add a row to the relevant `docs/index.md` section.
3. Keep `status: stable` only when the page reflects settled repo contracts; use
   `experimental` for exploratory framing.
4. If introducing a new durable domain term, update the appropriate glossary in
   the same change.

## Verification

At minimum:

```bash
rg -n "new-page-slug|<title>|<h1>" docs/index.md docs/background/new-page.html
rg -n "</content>|</invoke>" docs/index.md docs/background/new-page.html
git status --short
```

For static docs-only changes, full `make test` / `make lint` is usually not
necessary unless the user asks or the change touches Markdown/doc-check surfaces.
Say explicitly if you did not run them.
