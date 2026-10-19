# Shared skill suite

`skills/` is the canonical shared bundle. Six directories are copied unchanged
from Matt Pocock; `next-slice`, `show-me`, and `simplify-repository` are maintained
here. The single [lock](../skills-lock.json) records the upstream revision, original paths and all
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

## Simplify-repository adoption — 2026-10-19

[simplify-repository](../skills/simplify-repository/SKILL.md) is imported from the
[user-owned account skill](https://chatgpt.com/skills?skill_id=6ad5c4766910819191f51bfe0187a2e6),
version 2. Its workflow, references, host metadata, and icon retain the account
source content. It supports evidence-based repository simplification while
preserving behavior and public contracts; it does not authorize unrelated rewrites.

Sync accepts additions to an existing managed selection when prior files match
their receipt and new destinations are absent. Unmanaged collisions, including
empty directories, and retired skills still require explicit reconciliation.
