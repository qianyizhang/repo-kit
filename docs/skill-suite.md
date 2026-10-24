# Shared skill suite

`skills/` is the canonical shared bundle. [skills-lock.json](../skills-lock.json)
owns selection, delivered hashes, upstream revisions and original hashes, and
local adaptations with their reasons. Preserve upstream attribution and licenses.
Skills install once per user; repository-specific skills and contracts stay local.
Copier delivers `template/` governance separately. Local discovery here contains
only `maintain-repo-kit`.

## Install and check

From repo-kit with Python 3.12:

```sh
python3.12 scripts/skills.py check --source-only
python3.12 scripts/skills.py diff
python3.12 scripts/skills.py sync
python3.12 scripts/skills.py check
```

The default destination is `~/.agents/skills`; `--installed-root PATH` selects
another discovery location or a disposable verification directory. Parent
discovery symlinks are respected. Sync changes only managed skills and their
license; its generated receipt records the applied lock.

The source lock must match. Sync refuses unmanaged collisions (including empty
directories), edited or missing installed files, and symlinks inside managed
skills. Additions require absent destinations and an unchanged prior installation.
Preserve and reconcile local edits or retired skills before retrying.

## Recovery

Previous managed files and their receipt remain under `.repo-kit-skill-backups/`
beside the resolved destination, outside skill discovery. An interrupted update
leaves a record: `check` and `diff` report it without writing. The next explicit
`sync` verifies old/new hashes and backups, restores the previous installation,
then retries. A completed update only needs its leftover record removed.
Unexpected edits or changed backups stop recovery before paths move; preserve
and reconcile them manually. This handles process interruption, not power loss.

To roll back, restore a reviewed bundle and lock in repo-kit, review the diff,
then sync. Restore independently edited installations from their recovery copies
before applying another lock.

## Review an update

Inspect selected upstream skills, dependencies and invocation policy in a clean,
disposable checkout. Use its exact reviewed commit:

```sh
python3.12 scripts/skills.py refresh --upstream-checkout /path/to/clean/checkout --revision FULL_COMMIT
git diff -- skills skills-lock.json
python3.12 scripts/skills.py check --source-only
python3.12 -m unittest discover -s tests -p 'test_skills.py' -v
```

Refresh reads committed blobs, excludes ignored generated files, and neither
fetches nor installs. It preserves declared adaptations only against unchanged
upstream baselines. A changed or removed adapted file stops refresh before
writes; reconcile the adaptation and exact provenance explicitly.

For reviewed local-skill or adaptation edits, run
`python3.12 scripts/skills.py lock`. Only declared entrypoint adaptations may
differ; upstream supporting files, metadata and license stay unchanged. Use the
current script: schema 2 makes older check/sync/lock commands reject adapted
bundles, while the current script still reads legacy unadapted locks. Installation
receipts and recovery remain schema 1.

Review upstream monthly or when friction appears; no background updater is
installed. Test changed instructions on a representative task as well as through
structural checks. Finish with `diff`, explicit `sync`, then `check` as above.
Git owns local change history.

## Invocation and repository bindings

`retro` and `improve-codebase-architecture` require explicit invocation. Other
skills may be selected for relevant tasks. Retain upstream metadata; record any
required host exception in the lock.

Repository guidance maps names such as `GLOSSARY.md`, `docs/adr/` and
`CODING_STANDARDS.md` to existing owners. Local contracts, tests, language and
accepted decisions govern that binding. Skills add no write authority and need
no copied local rules, mandatory ledger or repeated confirmation.

## Selection and provenance

The lock owns the current selection. These records explain local additions:

- [Shared delivery decision](models.md#decisions): the initial
  2026-10-14 migration retired generic wrappers, `glossary-drill` and the maintained
  `explain-layman` runtime/validator. Older Copier consumers still need separate
  baseline reconciliation. Specialized consumer skills remain locally owned.
- [Review outcomes](reviews/README.md) condense the finish-work trial, UI review
  corrections and MCP construction rationale. Their skills own current procedures.
- [Simplify-repository](../skills/simplify-repository/SKILL.md): imported on
  2026-10-19 from the [user-owned account skill](https://chatgpt.com/skills?skill_id=6ad5c4766910819191f51bfe0187a2e6),
  version 2, retaining its workflow, references, host metadata and icon.

Temporary migration recovery is retained only for a named unresolved obligation;
remove it after resolution under the [artifact rules](../user/practices/artifacts.md).
