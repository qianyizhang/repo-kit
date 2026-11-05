# Installed version and status

From repo-kit, check both user installations against a committed revision:

```sh
python3.12 scripts/installation.py status --revision HEAD
```

The command prints the full expected commit, resolved installation paths, each
bundle's installed source commit, and `CURRENT`, `OUTDATED` or `ERROR`. Exit 0
means both installations match the selected source and their integrity receipts.
Exit 1 means a difference, missing receipt, interrupted installation or invalid
input needs attention. It reads committed Git objects, so unfinished working-tree
changes are excluded. It does not fetch remote changes; `HEAD` means local HEAD.

Use `--codex-home PATH` and `--installed-root PATH` to check another profile.
Instructions default to `CODEX_HOME` or `~/.codex`; skills default to
`~/.agents/skills`, resolving parent discovery symlinks.

## Identity and provenance

File hashes remain authoritative. Personal instructions carry them in
`CODEX_HOME/.repo-kit-user-instructions.json`. Skills carry the locked hashes and
lock digest in `INSTALLED_ROOT/.repo-kit-skills.json`.

Both receipts also record `sourceRevision`: the full local repo-kit commit used
for that bundle. This is separate from the skills' external `upstreamRevision`.
An installation from an uncommitted or non-Git source records `null`; legacy
receipts without provenance remain readable. Status reports those identities as
unknown but still checks the actual installed content and receipts.

A recorded commit may differ from the expected commit while the content is
`CURRENT`: unrelated commits do not change a bundle. Status verifies the selected
content instead of requiring the commit labels to be equal. Installed files do
not prove an already-running chat has reloaded them; restart cached hosts/chats
when needed.

## Install the committed version

```sh
python3.12 scripts/user_instructions.py sync --revision HEAD
python3.12 scripts/skills.py sync --revision HEAD
python3.12 scripts/installation.py status --revision HEAD
```

Revision-aware sync uses the selected committed bundle even in a dirty worktree.
The usual collision, local-edit and recovery guards still apply. A successful
sync also refreshes provenance when content was already current. Without
`--revision`, existing sync/check/diff commands use the working tree; sync records
HEAD only when that entire bundle exactly matches HEAD. Review before installing;
these commands add no authority to install unfinished work.
