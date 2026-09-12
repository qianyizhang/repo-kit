# Vocabulary practice

Self-contained CLI `glossary-drill` (package `glossary_drill/`). From repo root:

```bash
uv run --project .codex/skills/glossary-drill glossary-drill --help
uv run --project .codex/skills/glossary-drill glossary-drill quiz --count 5
uv run --project .codex/skills/glossary-drill glossary-drill status
# Self-contained offline Mastery Ladder game (light/dark, keyboard, ladder board):
uv run --project .codex/skills/glossary-drill glossary-drill --repo-root . html --count 15 --open
```

Restricted sandbox fallback (if present):
`.codex/skills/glossary-drill/.venv/bin/glossary-drill …`

## Role split

The deterministic core does **geometry, scheduling, and rendering**; semantic
latitude belongs to the agent.

| Owner | Responsibility |
| --- | --- |
| **Deterministic code** | Parse tables → cards; deck selection; MCQ templates (2 kinds) with **real-term distractors**; spaced-repetition scheduling (Leitner box + recency); miss-explanation data (picked vs. answer glosses, ≠ note); lint matching; per-profile local state |
| **Agent** | Run the conversation (present MCQ letters, collect A/B/C/D); grade from `correct_index`; read out the miss-explanation; optionally sharpen phrasing / add a distractor from its own understanding; call `record` |

## Modes

1. **`onboard`** — guided order: binding `spine` → confusable → `_Avoid_` → rest.
2. **`quiz`** — spaced-repetition MCQ: unseen and overdue-weak terms first,
   mastered terms recede. Advances the session clock. Offline, no network.
3. **`status`** — coverage/mastery snapshot: seen/total, mastered, weak, unseen,
   per-box distribution.
4. **`record`** — persist one answer (`--correct` / `--wrong --confused-with T`).
5. **`html`** — self-contained offline **Mastery Ladder** game (light/dark
   toggle, A–D keys, combo/XP, a full ladder board, and a copy-paste bridge
   back to CLI state). Every term climbs boxes `0..MAX_BOX`; a correct answer
   climbs a rung, a miss drops the chip back to box 0 — this always plays the
   weakest terms soonest, superseding the old separate "weak-first" button.
   Boxes below `MASTERED_BOX` are multiple choice (real confusable-neighbour
   decoys); `MASTERED_BOX`+ swaps to **free recall** — type the term from
   memory, graded client-side. Challenge selection and MCQ decoys run in
   vanilla JS from a per-card payload (glosses + real-term decoy pool); Python
   only bakes that payload and each card's starting box from CLI state — no
   network, no agent at runtime. Presentation only — glossary MD stays SSOT.

### Default deck

Rows that are **confusable/clarification**, have **`_Avoid_`**, or appear in
binding **`spine`**. Use `--all` for the full table set.

### Spaced repetition & progress

Each answer moves a term through Leitner boxes (correct → up, wrong → down) with
`last_seen` recency; `quiz`/`html` order by urgency so weak and unseen terms
surface first and mastered terms fade. `status` shows the mastery map. Question
*content* (kind, distractors, option order) is re-rolled each session, so a
stable card order never means a repetitive drill.

### State (per learner)

Default dir **`artifacts/glossary-drill/`**; keep it ignored locally. It holds
one file per profile: **`state-<profile>.json`**. Profile defaults to `$USER`
(override with `--profile` or `$GLOSSARY_DRILL_PROFILE`) so teammates on one
checkout don't clobber each other. Stores Leitner box, pass/fail counts,
`last_seen`, and capped confusion history (`hard_decoys`).

**Reset one learner:** confirm the profile reported by `status` and resolve the
state directory from `--state-dir`, the optional binding, or the default above.
Delete only that profile's `state-<profile>.json`. For example, resetting profile
`alice` in the default directory is `rm -- artifacts/glossary-drill/state-alice.json`.
Resetting every profile requires an explicit request for all learners. Browser
progress is separate; deleting a CLI state file does not reset localStorage.
Never auto-writes `docs/glossary/*.md`.

### Optional binding

`docs/glossary/drill-binding.yaml` (missing = fine):

```yaml
spine:
  - Candidate
  - ProtocolAtom
locale: bilingual   # en | zh | bilingual
paths:
  glossary: docs/glossary
excludes: []
state_dir: artifacts/glossary-drill
```

Canonical answer ids are always English **`Term`** values.

## Agent protocol (quiz session)

1. `glossary-drill quiz --count N --json` (or human-readable without `--json`).
2. Present each stem; user answers with **A/B/C/D only** (no free-text essays).
3. Grade against `correct_index`. On a miss, read out the answer's gloss, the
   picked term's gloss, and the `note` (≠ caveat) — the teaching moment.
4. `glossary-drill record --term Term --wrong --confused-with OtherTerm` (or
   `--correct`). Next runs reweight via spaced repetition.

For requested terminology review, use [terminology lint](lint.md).

## Pitfalls

- Empty deck → add markdown tables under `docs/glossary/` or pass `--glossary-dir`.
- Distractors are real sibling terms; a tiny glossary yields fewer options (never
  fabricated fillers). Add more terms for richer MCQs.
- `correct_term=` in CLI output is for agents/tests — hide from learners if desired.
- The Mastery Ladder stores live progress in the browser (its own
  `glossary-drill:ladder:v1` localStorage key, seeded from CLI state but not
  shared with it); use its **Sync to CLI** block to fold a browser run into
  `artifacts/glossary-drill` state via `record` calls.
