---
name: finish-work
description: Review and close a completed work slice, fixing supported findings and committing when requested. Use for end-of-slice cleanup or review-before-commit; broader cleanup and feature work stay separate.
---

# Finish work

Audit the completed change for behavior, verification and delivery gaps. **No
further changes needed** is a valid outcome; cleanup has no edit quota.

## Scope and reuse

Use accepted session decisions as the brief. Identify the intended outcome,
owned paths/hunks, review base and commit intent. Inspect fresh branch/HEAD,
staged and unstaged changes, and relevant new files. Use an explicit base,
otherwise the known session starting point/commits or HEAD for pending work.
A clean worktree can still contain a completed slice. Ask only about materially
ambiguous boundaries.

Reuse context, review and verification while their tested inputs, dependencies
and environment still apply. First closeout covers the owned slice; repeats cover
changes and remaining review/evidence gaps. Read repository instructions and only
the contract/review entries triggered by that scope. Select relevant diff sections
and surrounding code before broad reads.

Distinguish unrelated work from required dependencies. Record enough starting
state to preserve it; ordinary changes need no manifest. For creating or improving
a repository review binding, read [repository-rules.md](references/repository-rules.md).

## Review the remaining gaps

- **Behavior:** compare with accepted intent; follow affected callers, state
  transitions, outputs and relevant failure/recovery paths. Check missing and
  unrequested behavior separately.
- **Repository fit:** check ownership, duplication, stale callers/docs and needless
  complexity. Simplify only when it removes a concrete burden within the slice.

For each material finding, identify its trigger, consequence, location and
smallest useful fix. Label uncertain concerns and pre-existing/out-of-scope issues.
For UI findings, classify against the review base and follow shared changes to
relevant consumers. Use the repository's UI/runtime verification rules; disclose
uninspected surfaces. Delegate read-only reviews for justified risk or breadth when
authorized; give reviewers the slice, brief and contracts, keeping edits with one
owner. A same-session pass is not independent.

## Fix and verify

Within authorized scope, fix supported defects and re-review affected boundaries.
Keep accepted decisions settled; hand off unrelated defects, new product choices
and broader cleanup rather than expanding the closeout.

For substantive fixes, check that the regression detects the actual defect;
demonstrate failure before repair when practical. Use stable behavior boundaries,
including failure identity and retained state where relevant. Prose/cosmetic edits
need no invented tests.

Run focused checks after fixes and required repository gates on the final relevant
state. Reuse applicable results; repeat for changed inputs, failures or unresolved
risk, not another round. Follow local launch rules. Report infrastructure blockers,
optional omissions and product failures separately.

When delivery includes installation, check migration/restart needs and outstanding
acceptance. Keep source, exact candidate, installed package and active runtime
claims distinct. Follow existing artifact/retention rules; routine checks need
only a handoff result, not new receipts or reports.

## Close

Stop when material in-scope findings are resolved and relevant verification is
accounted for. Required gates or unresolved material defects block readiness;
a qualified checkpoint needs repository policy or existing user authorization.
Repeated findings in one boundary call for targeted investigation, not unlimited
polish passes.

Commit only when requested; otherwise hand off the reviewed diff. For an authorized
commit, inspect fresh status, stage owned changes and review the complete candidate
for unintended files, secrets, missing dependencies and
stale claims. Preserve unrelated staging. When partial staging or shared changes
make the candidate uncertain, use existing candidate tooling or a scoped index
and disposable export; a passing shared checkout can hide excluded dependencies.
Report dependencies outside authorization rather than adopting them.

Use normal hooks; inspect hook edits and refresh affected checks. Verify the
commit matches the reviewed candidate and inspect remaining status. This skill
adds no authority to push, install, deploy, merge, rewrite history or delete
unrelated work.

Report the outcome/commit, actual review fixes, checks/limits and remaining work.
Do not relabel prior feature work as review fixes. Record a durable lesson only
when it changes a future decision, in its existing owner; no per-run ledger.
