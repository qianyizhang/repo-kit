---
name: finish-work
description: Review, simplify, verify, and close a completed unit of work, committing when requested. Use for end-of-slice cleanup or review-before-commit requests; broader architecture surveys and feature expansion remain separate work.
---

# Finish work

Turn the completed slice into a coherent, verified change. A valid outcome is
**no further changes needed**. Findings need evidence; cleanup has no edit quota.

## Establish the boundary

Read repository instructions and their relevant contract, testing, and review
pointers. Use the user's accepted decisions and current session as the task brief;
a separate issue/spec is optional. If a repository review binding exists, read
the entries triggered by this change. For creating or improving that binding,
read [repository-rules.md](references/repository-rules.md).

Identify the intended result, owned paths/hunks, dependencies, and commit intent.
Inspect branch/HEAD, staged and unstaged diffs, and relevant untracked files.
An explicit review base takes precedence. Otherwise review the completed
session's changes against its known starting point, or the pending slice against
HEAD. Include staged, unstaged, and new-file contents; a branch diff alone can
miss all of the work. If everything is already committed, use the known session
commits. Ask only when a materially ambiguous boundary cannot be resolved locally.

Record the starting unrelated staging/worktree state sufficiently to preserve it.
Use exact paths and hashes when concurrent edits, evidence artifacts, or destructive
cleanup make byte identity material; ordinary small changes need no manifest.
Do not adopt another session's work merely because it is dirty or nearby.

**Ready to review:** the slice and its accepted behavior are identifiable, and
unrelated work is distinguished from required dependencies.

## Review before polishing

Inspect the diff and its affected callers, state transitions, and outputs through
two separate lenses. Run tooling for mechanical checks rather than narrating lint.

- **Intent and behavior:** Does the result satisfy the accepted task? Trace the
  changed path across its actual boundary, including relevant failure/retry,
  cancel/restart, persistence, and recovery behavior. Flag missing behavior and
  unrequested behavior separately. Exercise the rendered/native surface when
  visual or interaction behavior changed and the repository requires it.
- **Repository fit:** Does it respect local contracts and ownership? Look for
  duplicated decisions, redundant wrappers, speculative abstractions, stale
  callers, misleading names, and outdated docs. Smells are hypotheses; show the
  concrete maintenance cost before restructuring working code.

For each material finding, establish the trigger, observed or source-supported
consequence, affected location, and smallest useful fix. Label uncertain concerns
as unconfirmed. Distinguish defects, simplifications, evidence/documentation
corrections, and already-known or out-of-scope issues. Do not count a finding as
fixed until its change and verification exist.

An independent reviewer is useful for risky or broad changes when delegation is
authorized. Give it the pinned slice, task brief, and local contracts; withhold
the implementer's conclusions. Keep review read-only and give edits one owner.
For small slices, separate passes in the current session are sufficient; describe
them accurately rather than claiming independence.

## Fix and prove

Fix supported defects within the slice, then make behavior-preserving
simplifications that reduce a concrete burden. Keep existing accepted decisions
settled. A newly discovered product choice, broad redesign, or unrelated defect
belongs in the existing work tracker or the handoff, not an expanding cleanup.

Check whether tests could pass while the reported defect remains. For substantive
logic/recovery fixes, add or strengthen the smallest behavioral regression and,
when practical, demonstrate failure before the fix. Check fixture isolation,
expected error identity, and retained state where relevant. Call counts, ordering,
and exact bytes are legitimate when they encode a contract, not just construction.
Simple prose or cosmetic edits do not need invented tests.

Preserve authoritative sources, historical results, and source-pinned evidence.
Changed measured code needs a new evidence record, not silent replacement of an
old result. Before deleting artifacts or published paths, establish their role,
references, recovery, and deletion authority. Missing local references or large
size alone do not establish disposability.

Run focused checks during fixes and the repository's required gates on the final
relevant state. Reuse earlier results only if tested inputs, dependencies, and
environment still apply. Broaden or repeat checks for new changes, failures, or
unresolved risk, not simply to perform another round. Follow local launch rules;
infrastructure-blocked checks are neither passes nor product failures. Keep
offline, browser, native, live-service, and hosted-CI evidence distinct.

**Ready to close:** material in-scope findings are resolved, relevant verification
is accounted for, and the changed behavior and its claims agree. Unresolved
material defects or unsatisfied required gates block a ready-to-commit claim;
make a qualified checkpoint only when repository policy or existing user direction
allows it. Report optional unverified checks separately. Re-review the fixes and
affected boundaries; stop when no material issue remains. Repeated new findings
in one boundary warrant a targeted investigation, not unlimited polish passes.

## Commit the reviewed result

If the user requested a commit, continue under that authorization. Otherwise
deliver the reviewed diff without committing. This skill adds no authority to
push, deploy, install, merge, rewrite history, or delete unrelated work.

Inspect fresh status and stage only the owned changes. Check the complete staged
diff for unintended files, generated bulk, secrets, missing dependencies, and
stale claims. Existing unrelated staging must remain outside this commit and
retain its state. Use a scoped candidate index or equivalent isolation when
needed; do not clear someone else's index to make staging convenient.

When shared-worktree dependencies or partial staging make the candidate uncertain,
build/test a disposable export of the exact candidate. Include only intended
tracked content; a successful shared checkout can hide missing committed files.
If a dependency needs another owner's changes, include it only within existing
authorization; otherwise report the concrete boundary that prevents the commit.

Commit coherent units using the repository's normal hooks. If hooks modify files,
inspect those changes and refresh affected verification before completing the
commit. Verify the resulting commit against the reviewed candidate and inspect
remaining status. A clean owned slice can coexist with unrelated dirty work.

Finish with the outcome/commit, material fixes by category, checks and limitations,
and remaining work. Do not present all pre-existing feature work as review fixes.
Capture a durable lesson only when it changes a future decision; use the existing
owner or the binding guidance. No mandatory per-run report or ledger entry.
