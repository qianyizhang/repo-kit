---
description: Adopt glossary-drill in a governance-kit consumer repo.
scope: skill adopt note
status: experimental
last_update: 2026-07-10
---

# Adopting `glossary-drill`

## Prerequisites

- Glossary markdown under `docs/glossary/**/*.md` with tables that include a
  **Term** column and a gloss column (`中文解释` / definition / meaning).
- Optional `_Avoid_` column and/or confusable sections (headers matching
  confusable / clarification / bounded vocabulary / do not confuse).

## Install

Seeded by the governance kit under `.codex/skills/glossary-drill/` (skip-if-exists
on update). If missing, copy the skill directory from the kit template or from
another consumer.

```bash
uv run --project .codex/skills/glossary-drill glossary-drill quiz --count 5
uv run --project .codex/skills/glossary-drill glossary-drill status
uv run --project .codex/skills/glossary-drill glossary-drill lint --text "…"
uv run --project .codex/skills/glossary-drill glossary-drill --repo-root . html --count 15 --open
```

HTML quiz is a self-contained offline file (default `artifacts/glossary-drill/quiz.html`).

Wire tests (optional, recommended):

```make
# in Makefile test-skills:
$(UV) run --project .codex/skills/glossary-drill pytest .codex/skills/glossary-drill/glossary_drill/test_core.py
```

## Optional binding

Create `docs/glossary/drill-binding.yaml` only if you want a spine path or
non-default locale/paths. Zero-config works without it.

## State

Progress lives in `artifacts/glossary-drill/state-<profile>.json` (one file per
learner; profile defaults to `$USER`) — do not commit. Safe to delete.

## What not to do

- Do not maintain a second flashcard JSON as glossary authority.
- Do not auto-edit glossary files from quiz failures (use `domain-modeling` if
  promoting an `_Avoid_` is a real language decision).
