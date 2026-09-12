---
name: glossary-drill
version: "0.5.0"
description: >-
  Practice repository glossary terms or check supplied prose for confusable
  terminology. Use for requested vocabulary practice or terminology review.
scope: glossary onboard quiz lint skill
status: experimental
document_class: artifact
last_update: 2026-09-12
---

# Glossary Drill

Practice accepted repository vocabulary or review supplied prose for confusable
terms. Glossary Markdown remains the authority; generated cards and progress
state are projections. Ordinary work needs no quiz or terminology-lint ritual.

## Select the workflow

- For requested onboarding, a quiz, the offline game, or learner progress, read
  [vocabulary practice](references/practice.md).
- For terminology review, read [terminology lint](references/lint.md).
- For installing or configuring the skill in a repository, read
  [adoption](references/adopt.md).

The CLI parses the glossary, schedules practice, renders the game, and matches
lint terms. The agent explains misses and judges meaning in context. Preserve
learner boundaries: resetting one profile must not erase another profile's state;
browser and CLI progress are separate. Never auto-edit glossary definitions.

## Completion

Finish the requested practice round and record its answers, or report the relevant
terminology findings. Label absent or ambiguous glossary evidence. Continue the
parent task after a terminology check; a review alone does not authorize practice,
progress updates, or glossary changes.
