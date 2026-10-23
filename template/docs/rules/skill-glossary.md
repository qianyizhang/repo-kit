---
description: Reference terms for skill invocation, information layout and maintenance.
scope: skill authoring glossary
status: stable
last_update: 2026-10-23
document_class: coordination
---

# Skill glossary

Reference for [local skill rules](skill.md), adapted from
[mattpocock/skills](https://github.com/mattpocock/skills) `writing-great-skills`.
The installed `writing-for-agents` owns the authoring procedure. This glossary
keeps terms needed by current and older consumer bindings; it adds no invocation
or permission policy. See the [agentic glossary](agentic-glossary.md) for task terms.

## Invocation

| Term | Meaning |
| --- | --- |
| **Model-invoked** | A skill available for selection from relevant task triggers. |
| **User-invoked** | A skill requiring explicit user selection under its declared host policy. |
| **Context load** | Material loaded into the agent's context. |
| **Cognitive load** | What the user must remember or find. |
| **Router skill** | An entrypoint that identifies which specialist workflow fits an intent. |
| **Description** | The discovery text stating a skill's purpose and invocation boundary. |

## Information hierarchy

| Term | Meaning |
| --- | --- |
| **Steps** | Actions whose ordering is fixed only where correctness or authority requires it. |
| **Reference** | Definitions, rules or examples read on demand. |
| **Progressive disclosure** | Conditional detail reached through a pointer naming when to read it. |
| **Co-location** | A concept's rule and caveats kept together. |
| **Sprawl** | Too much relevant material on one reading path. |

## Steering

| Term | Meaning |
| --- | --- |
| **Branch** | A distinct invocation case or workflow path. |
| **Leading word** | A compact, understood term that cues a recurring concept. |
| **Completion criterion** | Observable result and evidence establishing the requested scope is complete. |
| **Legwork** | Investigation the agent can resolve from available evidence. |
| **Premature completion** | Stopping before the requested result and applicable verification. |
| **Negation** | A prohibited action; pair a necessary restriction with the supported route. |

## Pruning

| Term | Meaning |
| --- | --- |
| **Single source of truth** | One owner per meaning. |
| **Duplication** | The same meaning maintained in multiple places. |
| **Sediment** | Stale material retained without a remaining purpose. |
| **No-op** | Guidance whose removal preserves required behavior on representative supported tasks. |
| **Relevance** | Whether material still changes a decision or outcome in scope. |

## Coordination (session, not skill body)

| Term | Meaning |
| --- | --- |
| **Frontier** | Decisions or work whose prerequisites are settled. |
| **Frontier batch** | The independent choices that can be resolved in one interview round. |
| **Context hygiene** | Retaining useful context and handing off when transfer or continuity requires it. |
