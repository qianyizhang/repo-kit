---
name: maintain-repo-kit
description: Survey and reconcile repo-kit's local branches and worktrees, portable changes in Copier consumers, and external skill upstreams. Use for repo-kit maintenance, branch absorption, downstream promotion, upstream review, or governance release preparation.
---

# Maintain repo-kit

Keep three change flows separate: local Git topology, downstream consumer
refinements, and external upstream ideas. Survey first; preserve authority and
provenance through every absorption.

## Start with evidence

Run the read-only survey from the repository root:

```bash
python .codex/skills/maintain-repo-kit/scripts/survey.py
```

Use `--base <branch>` or `--consumer-parent <path>` only when the defaults are
wrong. Treat its classifications as candidate generation, not merge authority.

Then inspect the exact diff, commits, ownership contract, and verification
commands for every candidate. Stop when a relevant worktree is dirty, a ref is
missing, or authorship is ambiguous.

## Reconcile one flow at a time

### Local branches and worktrees

1. Classify each branch relative to the base: ahead-only, behind-only, diverged,
   or base.
2. For an ahead-only branch, review its commit range and diff, run the repo
   gates, then prefer a fast-forward of the base.
3. For a diverged branch, reconstruct both intents from commits and owning
   artifacts before proposing merge or rebase. Never resolve by choosing the
   newest text blindly.
4. Remove a linked worktree only after its tree is clean and its branch is
   merged or explicitly abandoned by the user. Delete a branch only after the
   same proof.
5. Re-run the survey after each mutation. Keep the base checkout clean before
   starting the next flow.

Branch merges, rebases, branch deletion, worktree removal, tagging, and pushing
are approval-gated unless the user's current request explicitly authorizes the
exact action class. Never infer push or deletion authority from permission to
review or merge.

### Downstream refinements

Consumers declare repo-kit through `.copier-answers.yml`. Compare each consumer
against its recorded `_commit`, not only against current `HEAD`:

- a managed-file delta relative to `_commit` is a portable-change candidate;
- a skipped/seeded delta may be portable or repository policy and needs semantic
  classification;
- a difference from current kit alone is update lag, not downstream authorship;
- a consumer-only skill is not automatically a kit candidate.

For a portable candidate, identify the consumer commit and rationale, recreate
the minimal change in `template/`, verify it here, then update consumers through
`governance-sync`. Do not copy a dirty working-tree snapshot upstream. Keep
repository vocabulary, paths, authority, and source identity downstream.

### External upstreams

Read [upstreams.md](references/upstreams.md) before fetching or proposing an
external change. Fetch into a temporary directory, record the reviewed commit,
and compare ideas and behavior rather than file names alone.

Classify each finding as:

- `adopt` — closes a demonstrated local gap;
- `adapt` — useful but must preserve local doctrine or tool constraints;
- `watch` — promising, with no current local need;
- `reject` — violates safety, authority, or simplicity boundaries;
- `already-covered` — no change needed.

Include source commit, local evidence, affected paths, semantic delta, risk,
and a recommendation. Preserve attribution when an idea is adopted.

## Grill only decisions

Resolve facts from the repositories. When adoption still depends on user
preference or policy, invoke the local `grilling` primitive:

1. Present a compact triage table before any question.
2. Ask only the unblocked decision frontier, with a recommended answer and the
   cost of the main alternative.
3. Keep dependent questions for the next round.
4. Do not implement an external proposal until the user confirms the lock.

Routine branch retirement with complete evidence is an operation, not a design
interview. Conflicting intent, authority changes, and workflow-default changes
are decisions and should be grilled.

## Completion

Finish with:

- the post-operation survey;
- verification commands and results;
- absorbed refs and retained refs;
- downstream candidates with source commits;
- external findings with reviewed commits and dispositions;
- explicit unresolved decisions and the next approval-gated action.
