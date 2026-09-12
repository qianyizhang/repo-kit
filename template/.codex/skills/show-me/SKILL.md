---
name: show-me
version: "1.2.1"
description: >-
  Explain a mechanism, relationship, or change with a compact visual grounded
  in available evidence.
scope: compact visual explanation
status: stable
last_update: 2026-09-12
document_class: artifact
---

# Show me

Make the key relationship visible. Skip the preamble, keep prose brief, and
prefer one clear view over a gallery. Explain the current topic or a labeled
proposal; use `show-gap` to assess feature fit and `next-slice` to prioritize
work.

Ground labels in current evidence: real paths, functions, components, states,
and data where available. Mark hypothetical shapes and omit detail that does not
answer the question.

For a materially cross-cutting project or change, lead with the relevant
core-model relationship and show any before/after effect. Otherwise explain the
local mechanism directly. Descend into code, files, stack, or milestones only as
evidence.

## Pick the smallest useful shape

| Shape | Use it for |
| --- | --- |
| Pseudocode | Logic or an algorithm |
| Call or component tree | Runtime flow or UI ownership |
| Shallow file tree | Responsibility or a broad refactor |
| Mermaid | Sequence, data flow, interaction, or hierarchy |
| Focused diff | A change to an already understood shape |

Show the whole block only when most of it is new, omitted context would hide
ownership or order, or the user needs a copyable target.

## Data transformations

For parsing, ETL, curation, or projection explanations, read
[show the states](references/data-transformations.md) before composing the view.
Trace one representative record through intermediate states to its final
consumer-visible and stored outcome.

## Artifact boundary

Keep the result in conversation by default. When the user explicitly asks for a
one-off interactive visual, use the environment's supported visualization
workflow and verify the rendered result. Route a maintained page, slide deck,
series, or stakeholder artifact to `explain-layman` and its repository binding.

## Completion

The visual makes the key relationship clear, labels are evidenced or marked
hypothetical, and the prose adds meaning instead of repeating the picture.

Adapted from HumanLayer's `show-me` skill at commit
`4d8d644ca747517973f58d7953f58d7cd07520cd`; see `LICENSE`. Model-first,
direct-manipulation guidance was informed by Geoffrey Litt's
[essay on understanding](https://www.geoffreylitt.com/2026/07/02/understanding-is-the-new-bottleneck).
