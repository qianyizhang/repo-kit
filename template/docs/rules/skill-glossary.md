---
description: Portable skill-authoring vocabulary — levers on predictability.
scope: skill authoring glossary
status: stable
last_update: 2026-07-16
document_class: coordination
---

# Skill glossary

Disclosed reference for [`skill.md`](skill.md). Vocabulary adapted from
[mattpocock/skills](https://github.com/mattpocock/skills) `writing-great-skills`.
A skill wrangles determinism from a stochastic system; the root virtue is
**predictability** (same *process* every run, not the same output).

Sibling: [`agentic-glossary.md`](agentic-glossary.md) — the broader
agent-collaboration register (lock, slice, handoff, packet, seam…). This sheet is
for skill **authors**; that one is for anyone **driving a task**. Terms this sheet
owns (*Frontier*, *Frontier batch*, *Context hygiene*, *leading word*, *SSOT*) are
pointed to from there, not redefined.

## Invocation

| Term | Meaning |
| --- | --- |
| **Model-invoked** | Keeps a machine-facing **description**; agent or human can reach it; other skills may invoke it. Pays permanent **context load**. |
| **User-invoked** | `disable-model-invocation: true` (+ matching Codex policy). Description is human-facing (picker one-liner, no trigger lists). Zero context load; spends **cognitive load** (human is the index). |
| **Context load** | Cost of always-loaded model-invoked descriptions. |
| **Cognitive load** | Cost of remembering user-only skills. Not always bad — it is the price of human agency. |
| **Router skill** | User-invoked skill that *names* other user-only skills and when to reach for them (cannot fire them). Cure when cognitive load piles up. Prefer an index **Main flows** map when one user-only router is enough. |
| **Description** | Always-loaded trigger for model-invoked skills. One trigger clause per genuine **branch**; front-load **leading words**. |

## Information hierarchy

| Term | Meaning |
| --- | --- |
| **Steps** | Ordered actions in `SKILL.md`; each ends on a **completion criterion**. |
| **Reference** | On-demand material (rules, taxonomies, templates). |
| **Progressive disclosure** | Push branch-only reference behind a **context pointer**; inline what every path needs. Pointer *wording* decides reliability. |
| **Co-location** | Keep a concept's definition, rules, and caveats under one heading. |
| **Sprawl** | Skill too long even when every line is live — disclose or split. |

## Steering

| Term | Meaning |
| --- | --- |
| **Branch** | Distinct invocation case / path through the skill. |
| **Leading word** | Compact pretrained concept (or clearly defined coinage) repeated as a token to anchor behaviour and invocation (*full*, *FAITHFUL*, *done ladder*, *frontier*). Collapse restated policy into one word when priors exist. |
| **Completion criterion** | Checkable (and preferably exhaustive) done bar for a step or flat reference set. |
| **Legwork** | Within-step digging the agent does without offloading to the user. |
| **Post-completion steps** | Later steps visible in context that tug the agent forward. |
| **Premature completion** | Ending a step early. Fix order: sharpen the criterion first; only if still fuzzy *and* rush is observed, hide later steps via a real context boundary (fresh session / subagent), not an inline skill call. |
| **Negation** | Steering by "don't…" backfires; state the positive target. Keep hard rails only with a paired positive route. |

## Pruning

| Term | Meaning |
| --- | --- |
| **Single source of truth** | One authoritative home per meaning. |
| **Duplication** | Same meaning in two places (≠ intentional leading-word token repeat). |
| **Sediment** | Stale layers that settled because removal felt risky. |
| **No-op** | Line the model already obeys by default — delete, don't trim. |
| **Relevance** | Does the line still bear on what the skill does? |

## Coordination (session, not skill body)

| Term | Meaning |
| --- | --- |
| **Frontier** | Decisions (or tickets) whose prerequisites are settled and can be asked/worked now. |
| **Frontier batch** | Numbered grill round over the whole independent frontier; recompute after answers. |
| **Context hygiene** | Keep DECIDE/fit/slice packaging in one window until a durable handoff exists; prefer a fresh window per IMPLEMENT work item; write a session handoff near degraded context. |
