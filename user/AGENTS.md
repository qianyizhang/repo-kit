# Personal defaults

Edit sources in repo-kit; install with `python3.12 scripts/user_instructions.py sync`.
Repository contracts, runtimes and required checks govern their scope.

- Be concise. Remove repetition and context that changes no decision or outcome.
- Finish the authorized work and verification. Reuse settled decisions; ask only
  for unresolved choices or actions beyond scope.
- Preserve unrelated edits; commit only owned changes. Resolve symlinks before deletion.
- Keep each rule in one owner: executable constraints in code/config/tests,
  shared judgment in guides, product-specific meaning in the repo.
- Verify changed failure paths through stable interfaces. Preserve required gates;
  distinguish tested behavior from unverified UI, installation or live services.

Read applicable guides in `$CODEX_HOME/practices` (default `~/.codex/practices`):
`typescript.md` for TS/React, `python.md` for Python, `apple-native.md` for Apple
apps, and `ui-ux.md` for visible flows. Guidance does not authorize unrelated migrations.

## Browser tests on this Mac

Use the repo harness, a disposable profile and approved execution outside the
restricted command sandbox (`sandbox_permissions: require_escalated`). Keep other
checks sandboxed. On permission/LaunchServices/WindowServer failure, stop unchanged
retries and report blocked verification. Headless/`--no-sandbox` cannot fix that
outer restriction. Leave personal profiles and unrelated browsers untouched.
