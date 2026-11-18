---
name: reconcile-main
description: Reconcile local main and clean up branches or worktrees. Optionally sync remote main and triage GitHub issues and PRs during repository closeout.
---

# Reconcile main

Bind the drill to named repositories. Use the local lane for relevant cleanup:
reconcile local work into main and account for extra worktrees and branches.
Ask whether to include the remote lane if a remote is configured and the
request has not settled it. The remote lane adds fetch/pull, remote integration
and delivery, issue/PR triage, and remote branch retirement within the agreed
scope. Keep working locally while that choice is pending; do not treat cached
refs as live. Local-only repositories stay local. The skill adds no authority
and does not override repository rules or publication holds.

1. **Inventory.** Read the repository rules and identify the primary checkout,
   destination, and verification gates. Check each worktree for staged,
   unstaged, untracked, or detached work; account for stashes. For the remote
   lane, read the GitHub delivery guide, fetch and prune, and list open issues
   and PRs separately, including drafts. Map PR heads and bases to branches;
   confirm the inventory is complete before acting on it.
2. **Triage.** Give each item a disposition: **done**, **superseded**, **finish
   now**, **retain** (active, held, or blocked), or **decide**. Cite main's actual
   behavior or a successor, not age or a closed PR. Close completed issues
   only after their acceptance is met; close retired work as not planned, with
   a reason and successor if any. Check the exact tip and final diff: a merged
   PR may leave a newer, unmerged branch tip; a squash may preserve an outcome
   without ancestry. A closed PR is not a durable home for unique work.
3. **Resolve decisions.** Use `grilling` for material choices about scope,
   conflicting intent, or what to keep. Present evidence, recommended
   dispositions, and the cost of the alternatives. Ask only the decisions
   whose prerequisites are settled. While waiting, finish independent work;
   do not reopen settled choices or treat silence as approval.
4. **Absorb and finish.** Fast-forward main when possible; otherwise reconcile
   both intents. Work in an isolated checkout if other work would be disturbed.
   Pick fixes that have bounded acceptance and runnable checks; leave larger
   or held work with a next action. Include tidy-ups only when they remove
   demonstrated friction in the touched scope; use `simplify-repository` for a
   separate cleanup. Resolve dependency updates with the pinned package
   manager and distinguish an upgrade regression from a failing baseline.
   Use `finish-work` to review and verify the candidate. Batch compatible
   changes where repository policy permits and use normal hooks. In the remote
   lane, push without rewriting main and track required CI on the delivered
   revision.
5. **Retire proved extras.** Remove only refs with durable preservation proof
   (exact ancestry or verified equivalent outcome, including any required
   source or evidence), or explicit abandonment. Confirm current main
   contains the preservation proof before deleting absorbed refs; for remote
   deletions, verify the durable destination from the live remote. Acceptance
   is a separate verdict. Check open and stacked PRs, active users, ignored
   data, recovery duties, and symlinks before removal. Remove clean worktrees
   through Git, then branches. Use exact expected-tip leases for remote
   deletions. If a tip changes, reclassify it; never retry a stale deletion.
6. **Read back and stop.** Verify checkout status, main, remaining refs, worktrees
   and stashes. For the remote lane, confirm local and remote main match, then
   read back remote refs, issue/PR dispositions, and required checks. Report
   what landed, what closed or was removed, and what remains with its reason
   and next action. Failed or pending checks block a claim of verified delivery.
   Stop after this snapshot and the bounded fixes; leave unresolved work visible.
   Do not set up a recurring cleanup.
