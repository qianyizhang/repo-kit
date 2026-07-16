---
name: grilling
version: "1.0.0"
description: >-
  Decision-interview primitive: serial one-at-a-time or frontier-batch rounds,
  recommended answers, facts from the tree, no implementation. Use when a
  plan needs stress-testing or when grill-with-docs / show-gap / next-slice
  need the shared grill loop.
scope: decision interview primitive
status: stable
last_update: 2026-07-16
document_class: artifact
---

# Grilling

Shared **model-invoked** interview primitive. User-facing shells and planners
compose it; they do not restate these rules.

| Caller | Adds on top of this primitive |
| --- | --- |
| `grill-with-docs` (user-only) | `domain-modeling` capture + DECIDE exit handoff |
| `show-gap` | residual decisions after evidence fit |
| `next-slice` | 1–5 rank decisions before implement handoff |

**Never implement** inside this skill. The caller's epistemic mode is usually
`DECIDE`.

Vocabulary adapted from [mattpocock/skills](https://github.com/mattpocock/skills)
(`grilling`, `batch-grill-me`).

## Modes

### Serial (default)

One decision at a time.

1. Restate the user's intent in one precise sentence when the request is fuzzy.
2. Ask **one** question. Give the recommended answer and the consequence of the
   main alternative. Wait.
3. Treat the first answer as **direction**, not a lock: restate a short proposed
   lock, probe scope/boundaries/exceptions, let the user correct wording.
4. Only then open the next decision.

### Frontier batch

Use when **≥3 independent decisions** already have settled prerequisites (their
answers do not depend on each other).

1. Map the open space as a design tree; the **frontier** is every decision whose
   prerequisites are settled.
2. Ask the **whole frontier in one numbered round**. Each item: question +
   recommended answer (+ brief alternative cost when material).
3. Wait for the batch. Accept `1. yes  2. your rec  3. defer` style replies.
4. Lock what settled; recompute the frontier; run the next round.
5. **Never** put a question in the same round as another answer it depends on.
   Facts you can look up are not frontier questions — resolve them yourself
   (or dispatch read-only legwork) without blocking independent decisions.

Serial remains correct when entropy is low or dependencies are tight.

## Standing rules

- **Facts vs decisions.** Look up code, docs, and the tree. Put only real
  product, domain, safety, or architecture choices to the user.
- **No implementation.** No product code, no OPERATE/IMPLEMENT switch mid-grill
  unless the user explicitly leaves the interview.
- **Completion.** Shared understanding is confirmed, or residual uncertainty is
  named as open questions / backlog — never guessed closed.

## Question standard

Each question must be concrete enough that the answer can change the design:

- The branch being resolved.
- Repo evidence or glossary/ADR conflict when relevant.
- Recommended answer (user may reply `your rec`).
- Consequence of choosing differently when material.

When the user asks for Chinese, grill in Chinese; keep code/glossary identifiers
in English.

## Pitfalls

- Batching dependent questions in one frontier round.
- Quizzing the user for facts the tree already answers.
- Implementing because the design "feels clear".
- Moving on after a first answer without a proposed lock.
