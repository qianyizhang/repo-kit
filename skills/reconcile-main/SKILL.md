---
name: reconcile-main
description: Reconcile branches and worktrees into a clean main for repository consolidation or closeout, syncing configured remotes and preserving local-only repos.
---

# Reconcile main

Agents may select this workflow when branch/worktree consolidation serves the
current task. Bind the drill to named repositories and
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
3. **Integrate.** Skill selection adds no authority for merges, pushes or deletion.
   Reuse explicit authorization for merge, commit, push and deletion;
   an explicit request for this complete drill supplies those actions within its
   named scope. Resolve destination/visibility holds before publishing. Fast-forward
   where possible; otherwise merge compatible intents. Reconcile overlapping
   dependency updates together using the pinned package manager to generate the
   lockfile. Check old branches against today's layout and runtime before accepting
   updates; overlapping bot branches can represent the same outcome. Distinguish
   incompatible upgrades from harness/environment failures before retiring an
   update; keep supported pins and record the reason in integration history.
4. **Batch delivery.** Use `finish-work` for review, repairs and required gates.
   Combine compatible integrations and all requested skill refinements before
   final publication; choose an integration shape that avoids repeated hook runs.
   Keep normal hooks, required install gates, CI and assertions. Reuse checks whose
   relevant source, dependencies and environment are unchanged. After a fix, run
   its focused regression and affected boundaries; submit one final candidate to
   full CI when feasible. Inspect hook/generated edits and use pinned tools.
   Commit owned changes and push main normally; local-only repos finish locally.
5. **Remove proved extras.** Git deletion safety is separate from application
   acceptance. Once remote main durably retains the reviewed commits/outcomes,
   clean worktrees plus ancestry or patch-equivalence proof permit removing
   absorbed refs while CI continues. Local-only repos use local main as the owner.
   Resolve symlinks and check active users; remove extra worktrees with Git, then
   branches. Lease remote deletions against reviewed heads so concurrent work
   survives. Preserve unresolved work, ignored app data and recovery obligations;
   a blanket clean or forced removal cannot establish preservation proof.
6. **Report both outcomes.** Refresh remote state; check porcelain status is empty, main is
   checked out, only main remains in local/remote heads, and one worktree remains.
   Confirm main equals its remote head when configured. Account for any retained
   stash or blocked ref. Report topology completion separately from acceptance:
   follow required exact-head CI to a terminal result before claiming verified
   delivery. State pending/failed gates and measured bottlenecks; keep broader CI
   optimization as a separate proposal. Include final revisions and dispositions.

Stop the affected action on ambiguous work, changed remote heads or missing
destination decisions. A failed gate blocks verified delivery; safe ref cleanup
can continue when preservation proof holds. Continue independent repositories.
Completion is a verified snapshot, not a background janitor or permission to
disable branch bots.
