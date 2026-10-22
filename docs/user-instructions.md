# Personal working core and practice guides

`user/` owns the personal instruction bundle. It has three small surfaces:

| Surface | Responsibility |
| --- | --- |
| [AGENTS.md](../user/AGENTS.md) | Cross-project working agreements, host constraints, communication and routing |
| [Practice index and guides](../user/practices/README.md) | On-demand TypeScript/React, Python, Apple-native and UI/UX defaults |
| Repository adaptations | Local commands, runtime constraints, domain contracts, design identity and required gates |

Explicit repo instructions and executable contracts retain authority in their
scope. Skills own repeatable workflows; these guides supply the judgment they
consult. The [research review](reviews/2026-10-22-practice-library.md) records source
provenance, the survey boundary and the choices behind this split.

## Maintain the layers

When adding a document or reconciling a session/repo lesson:

1. Identify the concrete failure or decision it improves. Inspect the current
   owning rule and source evidence, including version/date and any counterexample.
   Dirty repo text is candidate evidence; promote from a reviewed clean revision
   or an explicitly reviewed authored change here.
2. Choose the smallest owner: code/type/config/test for a mechanical invariant;
   a topic guide for portable judgment; the working core only for cross-project
   agreements; a repo adaptation for bespoke meaning; an existing skill for a
   repeatable procedure. External sources remain references until selected.
3. Merge with the existing rule, narrow its applicability and remove duplication
   within the edited surface. Preserve important exceptions. Do not generalize
   game artifact pruning into scientific evidence-retention policy, or macOS
   acceptance into iOS acceptance.
4. Record primary links and review date beside the topic. Use exact upstream
   commits and retain licenses for copied/adapted material. Keep substantial dated
   comparisons in `docs/reviews/`; Git history owns ordinary change history.
5. Validate meaningful code examples under named toolchain/options and walk through
   representative tasks. Run the applicable source checks, review the installation
   diff, then explicitly sync. Structural checks do not prove better agent behavior.

Review guidance when a relevant dependency/source changes, a repeated correction
reveals a gap, or the user requests upkeep. There is no background updater, reverse
sync or mandatory per-task ledger. Prefer extending an existing guide; add another
only when its trigger and responsibilities are distinct. Keep broad repo rewrites,
toolchain migrations and consumer propagation separately scoped.

## Review and sync

From repo-kit, using Python 3.12:

```sh
python3.12 scripts/user_instructions.py diff
python3.12 scripts/user_instructions.py sync
python3.12 scripts/user_instructions.py check
```

The source is `user/AGENTS.md` plus flat Markdown files in `user/practices/`.
The destination is `CODEX_HOME` (default `~/.codex`); `--codex-home PATH` selects
another profile or a disposable test installation. Files are copied, not symlinked.
Only the working core is loaded globally; its routing points to the installed
practice index. `diff` and `check` never write. `check` exits nonzero for an absent,
unmanaged, edited, interrupted or outdated installation.

Initial adoption or deliberate reconciliation requires the reviewed installed
hash for each affected file. `diff` shows the old and proposed content/hashes:

```sh
python3.12 scripts/user_instructions.py sync --adopt AGENTS.md=<reviewed-installed-hash>
python3.12 scripts/user_instructions.py sync --adopt practices/python.md=<reviewed-installed-hash>
```

Repeat `--adopt` to accept multiple reviewed files. A mismatching hash refuses the
operation. A nonempty `AGENTS.override.md` blocks sync because it would shadow the
core. Reconcile that override separately. Only the current bundle receipt is
supported; unknown or retired formats require manual reconciliation.

## Drift and recovery

The generated `.repo-kit-user-instructions.json` receipt tracks each managed file.
Any unexpected local edit or missing file blocks the whole update before replacement.
Reconcile intentional edits into the source, review their meaning and diff, then
accept the exact local version with `--adopt FILE=SHA256`.

Before replacement, old contents are retained under
`CODEX_HOME/.repo-kit-user-instruction-backups/<sha256>.md` (using the same default
home when unset). Changed recovery copies block replacement. Managed files and
recovery entries must be regular files; the practices and backup directories must
not be symlinks. Unmanaged files, including other practice notes, stay untouched.
Removing a previously managed source file requires explicit retirement
reconciliation; sync does not silently delete the installed copy.

Each replacement is atomic. Guides install before the routing core. An interruption
can leave a mixture of old/new files; the pending receipt records both permitted
hashes per file. Read-only commands diagnose this; explicit `sync` finishes the
current reviewed source from known states. Unexpected edits block retry. This
handles process interruption, not power-loss durability or coordination with
concurrent external writers.

To roll back content, restore the desired source version, review the diff and sync.
Backups retain prior installed bytes for manual recovery. Use a fresh run to verify
instruction discovery where the host does not refresh the current chat; see the
[official discovery rules](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## Verify

```sh
python3.12 -m unittest discover -s tests -p 'test_user_instructions.py' -v
```

Disposable profiles cover guide addition, whole-bundle drift
refusal, reviewed adoption, symlinks, overrides and partial-update recovery.
The root unit suite also checks local Markdown links. Source/installation equality
is a delivery check; task walkthroughs and future usage assess the guidance itself.
