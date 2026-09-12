---
name: show-gap
version: "0.13.0"
description: >-
  Assess a proposed feature against built, planned, rejected, and deferred
  repository evidence. Use for feature-fit questions or a fit check needed by
  an authorized change.
scope: repo feature gap analysis skill
status: experimental
last_update: 2026-09-12
document_class: artifact
---

# Show Gap

Explain where a proposed feature fits and what remains. Use `next-slice` to
prioritize work and `show-me` to explain known behavior.

## Clarify intent and terms

- State who benefits and what should become possible in plain language. Infer
  whether the user needs an explanation, prototype, durable behavior, or staged
  combination; ask only when that distinction changes the work.
- Map the user's wording to glossary terms and aliases, briefly explaining any
  relevant forgotten or confusable distinction. State the interpretation and
  continue unless ambiguity changes scope, ownership, or implementation.
  Preserve accepted meanings while leaving room for genuinely new intent.

## Ground the fit

1. Follow the repository SSOT and navigator to relevant glossary terms, plans,
   work-item histories/ledgers, code, and tests. Check rejected, superseded, and
   deliberately deferred work before proposing a new shape.
2. Separate verified behavior from plans and prototypes. Name the owner, whether
   the proposed output owns behavior or only explains/renders it, what remains
   unverified, and any dependency, decision, review, or release gate.

Use aliases to search; `records/work-items/backlog.md` routes the records, and
`records/work-items/items/` holds their histories and ledgers. For example:

```bash
rg -n -i 'term|alias' docs records src tests
```

The agent judges fit; code, observed behavior, and repository checks support
implementation claims. A tracker status or design alone does not prove delivery.

## Classify

Apply the relevant states to each part of the request; states may coexist.

| State | Meaning |
| --- | --- |
| `already_built` | Verified current behavior satisfies the requested outcome |
| `on_map` | An active plan or work item directly covers it |
| `overlap` | Partial or adjacent coverage; name the remaining behavior |
| `rejected_or_deprecated` | A durable record rejected or superseded it |
| `new_gap` | No direct coverage found within the surveyed scope |
| `blocked` | A named dependency, decision, or human gate remains open |
| `deferred_by_design` | Intentionally outside the current scope |

## Brief output

Lead with the verdict and practical implication in one sentence. Include linked
evidence and the remaining gap. For several distinct parts, use one short row
per part:

| Part | State | Evidence | Remaining gap / next action |
| --- | --- | --- | --- |

When intent is unclear, show one proposed scenario or flow: user action →
existing capability → desired outcome. Distinguish reused behavior, prototype,
and work still needed. Compare options only for a real choice, with a preferred
option and its trade-off. Omit empty fields and repeated summaries.

For a fit-only request, finish with the report. When this audit supports a larger
authorized task, return the findings to that task and continue within its scope.

## Continue when requested

- Use `grilling` only for unresolved scope choices. Preserve accepted decisions;
  ask again only when a material ambiguity or conflict remains.
- Revisit ownership and canonical terms if the proposed boundary changes. Route
  accepted cross-cutting model changes through `domain-modeling`.
- Once scope is settled and a durable artifact is requested, read
  [deliverables](references/deliverables.md) and choose the appropriate artifact.
  Discussion alone does not require a new document.

This skill contributes fit analysis. An implementation request can already
authorize the next step; do not require a new approval merely because the fit
analysis ended. Preserve named human gates and explicit review-only requests.
