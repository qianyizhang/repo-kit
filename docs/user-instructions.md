# Maintain personal instructions

## Sources

| Source | Installed path under `CODEX_HOME` |
| --- | --- |
| [Personal core](../user/AGENTS.md) | `AGENTS.md` |
| [Practice guides](../user/practices/) | `practices/<name>.md` |

Keep one source per rule. Put mechanical constraints in code/config/tests,
portable judgment in a guide, cross-project agreements in the core, and bespoke
meaning in the repo. Skills own procedures. Delete text that changes no decision.

For additions, identify the failure they prevent, merge with the owning rule,
retain necessary exceptions, and review source/version and meaningful examples.
Keep dated research and attribution in [the source review](reviews/2026-10-22-practice-library.md).
For vocabulary choices, use [ASD-STE100](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf).

## Sync

From repo-kit with Python 3.12:

```sh
python3.12 scripts/user_instructions.py diff
python3.12 scripts/user_instructions.py sync
python3.12 scripts/user_instructions.py check
```

`CODEX_HOME` defaults to `~/.codex`; `--codex-home PATH` selects another profile.
`diff` and `check` are read-only. Sync copies files and records their hashes.
Unmanaged collisions, local edits, missing files, symlinks and an active
`AGENTS.override.md` block replacement. Unmanaged notes stay untouched.

Reconcile local edits into their source, then accept the reviewed installed hash
with `sync --adopt FILE=SHA256` (repeatable). For retirement, verify/back up its
bytes, release its receipt entry, sync replacement routing, then remove the
unchanged old file. Preserve unexpected edits before proceeding.

Recovery copies live in `CODEX_HOME/.repo-kit-user-instruction-backups/<sha256>.md`.
An interrupted sync records known old/new hashes; rerun sync to finish. It refuses
unexpected edits. Replacements are individually atomic, not a whole-bundle
transaction or a lock against concurrent writers. Roll back by restoring source
and syncing. Restart chats whose host caches instructions.

Repos keep local contracts in `AGENTS.md` and point to the installed core. Remove
copied defaults and stale shared-skill copies during updates. From each affected
root or nested scope, use `codex debug prompt-input` to check that a fresh run
loads both the personal core and local instructions.

Run root verification after delivery changes; use representative tasks to assess
instruction quality. Passing structural tests does not establish agent compliance.
