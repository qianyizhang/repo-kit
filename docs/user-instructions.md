# Maintain personal instructions

## Sources

| Source | Installed under `CODEX_HOME` | Owns |
| --- | --- | --- |
| [Personal core](../user/AGENTS.md) | `AGENTS.md` | Cross-project agreements and routing |
| [Practice guides](../user/practices/) | `practices/<name>.md` | Portable judgment |
| Repository | Local `AGENTS.md`, code, config, tests | Local meaning and executable constraints |

- **Review standard** · Apply the [documentation practice](../user/practices/documentation.md). Keep a rule when it prevents a concrete failure and its exceptions affect the result.
- **Language** · [ASD-STE100](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf)
- **Attribution** · [Upstream registry](../.codex/skills/maintain-repo-kit/references/upstreams.md)

## Sync

| Command suffix for `python3.12 scripts/user_instructions.py` | Outcome |
| --- | --- |
| `diff` | Read-only preview of changes and conflicts |
| `sync` | Install the reviewed bundle and record file hashes |
| `check` | Read-only integrity verdict |

- **Destination** · `$CODEX_HOME` or `~/.codex`. Override with `--codex-home PATH`.
- **Committed revision** · [Installation status and revision-aware sync](installation.md)
- **Guardrails** · Unmanaged collisions, local edits, missing managed files, unsafe symlinks and a nonempty `AGENTS.override.md` block replacement. Unmanaged notes stay in place.

## Recovery

| Condition | Expected outcome |
| --- | --- |
| Local edit or unmanaged collision | Preserve intended changes in the source. Accept the reviewed installed hash with repeatable `sync --adopt FILE=SHA256`. |
| Retired source | Verify and back up its installed bytes, release its receipt entry, sync replacement routing, then retire the verified old file. Preserve unexpected edits. |
| Interrupted sync | Rerun sync against known old/new hashes. Unexpected bytes require reconciliation. |
| Rollback | Restore the reviewed source and sync. Recovery copies live at `CODEX_HOME/.repo-kit-user-instruction-backups/<sha256>.md`. |

- **Write boundary** · Atomic per file. Recoverable as a bundle after interruption. Concurrent writers require reconciliation.
- **Acceptance** · A fresh `codex debug prompt-input` loads the personal core and the local contract in affected scopes. Restart cached chats as needed. Use representative tasks to assess instruction quality.
