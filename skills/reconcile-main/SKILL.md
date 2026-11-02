---
name: reconcile-main
description: Absorb branch and worktree outcomes into a clean main, sync its remote when configured, and remove the absorbed refs.
---

# Reconcile main

Run only when explicitly requested. Bind the drill to named repositories and
their primary checkout. The target is one clean `main` and one worktree per repo;
with a remote, local and remote main must match and extra remote heads must be gone.
For an intentionally local-only repo, finish locally without creating a remote.

1. **Inspect once.** Read repository instructions, publication holds and checks.
   Record status (including untracked files), local/remote branches, worktrees,
   stashes and open PRs. Fetch/prune configured remotes before classifying refs.
   Inspect each worktree's actual status and path, including detached work. Scope
   the inventory to the named repo; avoid unrelated consumer or portfolio surveys.
2. **Account for outcomes.** Compare exact commits and final diffs with main.
   Distinguish unique work, ancestry-merged work, patch-equivalent/squashed work,
   and superseded work. Recover useful dirty or stashed changes before removal;
   ask about ambiguous intent or unavailable work instead of discarding it.
3. **Integrate.** Reuse explicit authorization for merge, commit, push and deletion;
   an explicit request for this complete drill supplies those actions within its
   named scope. Resolve destination/visibility holds before publishing. Fast-forward
   where possible; otherwise merge compatible intents. Reconcile overlapping
   dependency updates together using the pinned package manager to generate the
   lockfile. Check old branches against today's layout and runtime before accepting
   updates; overlapping bot branches can represent the same outcome. Distinguish
   incompatible upgrades from harness/environment failures before retiring an
   update; keep supported pins and record the reason in integration history.
4. **Verify and deliver.** Review the resulting diff and run required gates on the
   combined candidate. Batch compatible work before expensive checks; repeat only
   after relevant changes or failures. Package commands and hooks may install
   dependencies or change generated files; inspect their edits and use the pinned
   runtime throughout. Commit owned changes, push main normally,
   and follow exact-head CI to completion. Local-only repos skip remote steps.
   Preserve failed candidates and report concrete blockers.
5. **Remove proved extras.** After main durably retains each accepted outcome,
   remove clean extra worktrees with Git, then absorbed local and remote branches.
   Resolve symlinks and check active users before removing paths. For remote
   deletion, use the reviewed head as an explicit lease so concurrent work survives.
   Keep unrelated ignored app data, installed artifacts and recovery obligations.
   Never use a blanket clean or force-remove to manufacture a clean result.
6. **Prove done.** Refresh remote state; check porcelain status is empty, main is
   checked out, only main remains in local/remote heads, and one worktree remains.
   Confirm main equals its remote head when configured. Account for any retained
   stash or blocked ref; it prevents claiming the full drill complete. Report final
   revisions, absorbed/retired outcomes, checks and remaining limits concisely.

Stop a dependent action on ambiguous work, a failed gate, changed remote head or
missing destination decision; continue independent repositories. Completion is a
verified snapshot, not a background janitor or permission to disable branch bots.
