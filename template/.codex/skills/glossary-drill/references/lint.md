# Terminology lint

Use for a requested review of supplied prose against the repository glossary, or
when a concrete confusable-term issue needs investigation. This is not a routine
pre-implementation gate.

```bash
uv run --project .codex/skills/glossary-drill glossary-drill lint --text "supplied prose"
uv run --project .codex/skills/glossary-drill glossary-drill lint --file path/to/notes.md
```

The parser reads glossary tables; matching reports `_Avoid_` and confusable-term
findings. The agent checks each finding against its context and the glossary.
Treat matches as review signals, not automatic replacements. Default lint does
not update learner progress; use `--record` only when that update is requested.
Lint never changes the glossary. Route accepted meaning changes to
`domain-modeling` within the user's authorized scope.

If available in a restricted sandbox, use
`.codex/skills/glossary-drill/.venv/bin/glossary-drill` without reinstalling.
