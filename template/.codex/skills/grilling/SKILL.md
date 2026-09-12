---
name: grilling
version: "1.2.0"
description: >-
  Resolve named, unresolved decisions with evidence-grounded frontier-batch
  questions and recommended answers. Use for requested decision questioning or
  residual choices in grill-with-docs, show-gap, and next-slice.
scope: decision interview primitive
status: stable
last_update: 2026-09-12
document_class: artifact
---

# Grilling

Shared **model-invoked** interview primitive. User-facing shells and planners
compose it; they do not restate these rules. Ask only choices that materially
block the requested work. Use `grill-with-docs` for an explicitly requested
interview with durable capture; routine factual uncertainty needs investigation.

| Caller | Adds on top of this primitive |
| --- | --- |
| `grill-with-docs` (user-only) | `domain-modeling` capture + DECIDE exit handoff |
| `show-gap` | residual decisions after evidence fit |
| `next-slice` | residual priority, scope, or proof decisions |

**Never implement** inside this skill. The caller's epistemic mode is usually
`DECIDE`.

Vocabulary adapted from [mattpocock/skills](https://github.com/mattpocock/skills)
(`grilling`, `batch-grill-me`).

## Frontier-batch loop (default)

1. Restate the user's intent in one precise sentence when the request is fuzzy.
2. Map the open space as a design tree; the **frontier** is every decision whose
   prerequisites are settled.
3. Ask the **whole frontier in one numbered round**. Each item: question +
   recommended answer (+ brief alternative cost when material).
4. Wait for the batch. Accept `1. yes  2. your rec  3. defer` style replies.
5. A clear acceptance of a concrete recommendation locks that decision
   immediately, including “all your rec” or “go ahead” when the referent is
   clear. Restate the lock without requiring another reply. Ask again only
   when material scope, authority, or exception ambiguity remains. A decision
   lock authorizes implementation only when the user also requests that action.
6. Lock what settled; recompute the frontier; run the next round.
7. **Never** put a question in the same round as another answer it depends on.
   Facts you can look up are not frontier questions — resolve them yourself
   (or dispatch read-only legwork) without blocking independent decisions.

Use serial one-question rounds only when the user asks for them. A frontier with
one unblocked decision is naturally a one-question round; do not delay it to
manufacture a batch.

## Question standard

Each question must be concrete enough that the answer can change the design:

- The branch being resolved.
- Repo evidence or glossary/ADR conflict when relevant.
- Recommended answer (user may reply `your rec`).
- Consequence of choosing differently when material.

When the user asks for Chinese, grill in Chinese; keep code/glossary identifiers
in English.

## Completion

Restate settled decisions and leave residual uncertainty explicit. For an
explicit interview-only request, finish with the decisions. When a caller uses
this loop to resolve a blocker in an already-authorized task, return the settled
decisions to that caller and continue within its scope. A decision answer alone
does not authorize an implementation that the user has not requested.
