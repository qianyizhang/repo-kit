# Shared skill suite

| Source | Owns |
| --- | --- |
| [`skills/`](../skills/) | Shared skills and colocated source attribution and licenses |
| [`skills-lock.json`](../skills-lock.json) | Local selection, file hashes, external baseline and declared entrypoint adaptations |
| [`scripts/skills.py`](../scripts/skills.py) | Matt Pocock import set, source validation and guarded delivery |

- **Delivery** · One installation per user. Repository skills and bindings stay local. Repo Workbench delivers its own plugin skills.
- **Discovery here** · `maintain-repo-kit`.

## Install and check

| Command suffix for `python3.12 scripts/skills.py` | Outcome |
| --- | --- |
| `check --source-only` | Source matches the lock |
| `diff` | Read-only preview of installed changes and conflicts |
| `sync` | Install managed skills and license, record the applied lock |
| `check` | Verify every file in the managed installation |

- **Destination** · `~/.agents/skills`. Override with `--installed-root PATH`. Parent discovery symlinks resolve to their targets.
- **Guardrails** · Unmanaged collisions, including empty directories, unexpected edits, missing files and internal symlinks stop sync. New skills require absent destinations and an intact prior installation.
- **Committed revision** · [Installation status and revision-aware sync](installation.md)

## Recovery

| Condition | Expected outcome |
| --- | --- |
| Interrupted update | `diff` and `check` report pending recovery. Explicit sync of the same selection verifies known hashes, restores the previous state and retries. Completed updates clear the leftover record. |
| Unexpected bytes | Reconcile edits or changed backups before retrying. Recovery copies and receipts live in `.repo-kit-skill-backups/` beside the resolved destination. |
| Rollback | Restore the reviewed source and lock, reconcile independent installed edits, then sync after reviewing the diff. |

- **Recovery scope** · Process interruption.

## Review an update

| Change | Acceptance |
| --- | --- |
| Upstream refresh | Clean disposable checkout at the exact reviewed commit. Refresh reads committed blobs and preserves only adaptations whose upstream bases match. Changed bases or unmanaged destination files stop writes. |
| Local skill or adaptation | Updated selection in the lock, regenerated hashes with `lock`, and untouched upstream support files, metadata and licenses. |
| Source verification | `check --source-only`, skill tests and a representative task. Git checks and locking include tracked and nonignored skill additions. Exported and committed bundles must match the full lock. |
| Delivery | Reviewed diff, explicit sync and installed integrity check. |

```sh
python3.12 scripts/skills.py refresh --upstream-checkout /path/to/clean/checkout --revision FULL_COMMIT
python3.12 scripts/skills.py lock
python3.12 -m unittest discover -s tests -p 'test_skills.py' -v
```

- **Compatibility** · Use the current script for schema 2 adapted bundles. It also reads legacy unadapted locks. Installation receipts and recovery records use schema 1.
- **Cadence** · Monthly or when friction appears. Refresh is local and source-only.

## Invocation and repository bindings

- **Explicit invocation** · `retro` and `improve-codebase-architecture`. Other skills apply by task.
- **Authority** · Local contracts, language, tests and decisions govern repository bindings. Record host-specific invocation exceptions in the lock. [Reconcile main](../skills/reconcile-main/SKILL.md) keeps local and remote authority separate.
