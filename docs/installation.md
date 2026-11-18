# Installed version and status

- **Goal** · Verify both user bundles against one committed repo-kit revision.
- **Scope** · Local Git objects. `HEAD` means local HEAD. Use `--codex-home PATH` and `--installed-root PATH` for another profile.

```sh
python3.12 scripts/installation.py status --revision HEAD
```

| Result | Meaning |
| --- | --- |
| `CURRENT` | Installed content and receipt match the selected bundle. Both bundles current gives exit 0. |
| `OUTDATED` | Content or receipt differs, including a missing receipt or unfinished sync. Exit 1. |
| `ERROR` | An invalid input or blocking integrity condition prevents verification. Exit 1. |

## Identity and provenance

| Bundle | Default destination | Receipt |
| --- | --- | --- |
| [Instructions](user-instructions.md) | `$CODEX_HOME` or `~/.codex` | `.repo-kit-user-instructions.json` |
| [Skills](skill-suite.md) | `~/.agents/skills` with parent discovery symlinks resolved | `.repo-kit-skills.json` |

- **Integrity** · File hashes and the skill lock digest govern the verdict. Matching content can be current across different commits.
- **Provenance** · `sourceRevision` records the repo-kit commit. Skills also record the external `upstreamRevision`. Legacy and uncommitted sources can report unknown provenance.
- **Host acceptance** · A fresh chat or a restarted host loads the new content when the host caches installations.

## Install the committed version

```sh
python3.12 scripts/user_instructions.py sync --revision HEAD
python3.12 scripts/skills.py sync --revision HEAD
python3.12 scripts/installation.py status --revision HEAD
```

- **With `--revision`** · Sync reads the selected commit, applies normal collision and recovery guards, and refreshes provenance.
- **Without `--revision`** · Bundle commands read working-tree sources. Sync records HEAD only when the entire bundle matches its committed bytes.
