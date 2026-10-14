# Shared skill suite

`skills/` is the canonical shared bundle. Six directories are copied unchanged
from Matt Pocock; `next-slice`, `show-me`, and `finish-work` are maintained here. The single
[lock](../skills-lock.json) records the upstream revision, original paths and all
delivered file hashes. The MIT licenses are retained in the bundle.

Skills are installed once for the user account. Project-specific rules and skills
stay in their owning repository. This product is separate from `template/`:
Copier distributes governance, not the shared skills.

## Install and check

From the repo-kit root, with Python 3.12:

```sh
python3.12 scripts/skills.py check --source-only
python3.12 scripts/skills.py diff
python3.12 scripts/skills.py sync
python3.12 scripts/skills.py check
```

The default destination is `~/.agents/skills`; `--installed-root PATH` supports
another discovery location or a disposable verification directory. Existing
parent discovery symlinks are respected. Only nine managed directories and the
license are updated; unrelated skills stay untouched. The installation receipt
records the applied lock. It is generated state, not another source to maintain.

Sync refuses unmanaged collisions, edited or missing installed files, and
symlinks inside managed directories. Preserve and reconcile such changes before
retrying. Updates retain the previous managed installation under
`.repo-kit-skill-backups/` beside the resolved destination, outside skill discovery.
The source lock must match before sync.

## Review an update

Fetch Matt's repository into a disposable checkout and inspect the six selected
skills, their dependencies and invocation policy. Use its exact reviewed commit:

```sh
python3.12 scripts/skills.py refresh --upstream-checkout /path/to/clean/checkout --revision FULL_COMMIT
git diff -- skills skills-lock.json
python3.12 scripts/skills.py check --source-only
python3.12 -m unittest discover -s tests -p 'test_skills.py' -v
python3.12 scripts/skills.py diff
python3.12 scripts/skills.py sync
```

Refresh reads committed Git blobs, excludes ignored generated files, performs no
network request and installs nothing. Review upstream monthly
or when friction appears; changed instructions need a representative invocation
in addition to structural checks. No background updater is installed.

For edits to the three local skills, run `python3.12 scripts/skills.py lock` after
review; it refuses changes to upstream bytes. Git history owns local change
history. To roll back, restore the previous reviewed bundle and lock in repo-kit,
review the diff, then sync it. Restore independently edited installations from
their recovery copies before applying a different lock.

## Invocation and local bindings

`retro` and `improve-codebase-architecture` require explicit invocation. The other
seven skills can be selected for relevant requests. Keep upstream metadata as-is;
add host metadata only when required, recording that exception separately.

Each project's guidance routes upstream names such as `GLOSSARY.md`, `docs/adr/`
and `CODING_STANDARDS.md` to its existing owners. Local authority governs those
destinations, meaningful test selection, and already accepted decisions. A clear
acceptance needs no repeated confirmation. Use existing authorizations and ask
only for material unresolved choices. Skills confer no additional write scope.

## Migration — 2026-10-14

The eight-skill suite replaces repo-kit's generic wrappers. `glossary-drill` and
the maintained `explain-layman` framework are retired, including their runtime and
validator. Older Copier consumers are not updated by this migration. Reconcile
their recorded baseline before any later governance update or skill retirement.

Pre-migration repo-kit working files, staged patch and unstaged patch are preserved
locally under `.cache/skill-migration-20261014/`, with SHA-256 manifests. This
includes uncommitted deprecated work. It is recovery material, not active delivery.
The initial personal rollout covers game, EZ, Saul, TB3 and project-index; their
specialized skills and domain contracts remain locally owned.

## Finish-work adoption — 2026-10-14

The user approved [finish-work](../skills/finish-work/SKILL.md) as the ninth skill,
following [session review and a controlled trial](reviews/2026-10-14-finish-work.md).
It reviews a completed slice, fixes supported findings, verifies the intended
commit, and commits when requested. No further edits is a valid outcome.

Sync supports additions to a previously managed selection when old files still
match their receipt and each new destination is absent. Even an empty unmanaged
directory is a collision. Retiring skills still requires explicit reconciliation.
The previous installation and receipt remain in the normal recovery directory.

Repository bindings point to existing contracts, testing and retention owners.
They do not install local copies, run Copier, or require a new rulebook or ledger.
