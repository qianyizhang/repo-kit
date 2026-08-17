---
description: Adopt glossary-drill in a governance-kit consumer repo.
scope: skill adopt note
status: experimental
last_update: 2026-08-17
---

# Adopting `glossary-drill`

## Prerequisites

- Glossary markdown under `docs/glossary/**/*.md` with tables that include a
  **Term** column and a gloss column (`中文解释` / definition / meaning).
- Optional `_Avoid_` column and/or confusable sections (headers matching
  confusable / clarification / bounded vocabulary / do not confuse).

## Install

The governance kit manages `.codex/skills/glossary-drill/` through Copier
updates. If it is missing or locally divergent, reconcile it with
`governance-sync`; never copy another consumer's core.

```bash
uv run --project .codex/skills/glossary-drill glossary-drill quiz --count 5
uv run --project .codex/skills/glossary-drill glossary-drill status
uv run --project .codex/skills/glossary-drill glossary-drill lint --text "…"
uv run --project .codex/skills/glossary-drill glossary-drill --repo-root . html --count 15 --open
```

HTML output is the self-contained offline Mastery Ladder game (default
`artifacts/glossary-drill/ladder.html`).

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
