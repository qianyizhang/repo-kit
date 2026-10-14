---
name: maintain-repo-kit
version: "1.5.0"
description: Survey and reconcile repo-kit's local topology, downstream candidates, external upstream ideas, and Copier baselines. Use for maintenance, promotion, consumer reconciliation, or release preparation.
scope: repo-kit maintenance
status: stable
last_update: 2026-10-14
document_class: artifact
---

# Maintain repo-kit

Read root `CLAUDE.md` first. Keep local Git topology, consumer evidence, and
external ideas separate. All enter as Candidates; only explicit promotion
changes the shared `skills/` bundle or governance `template/`. Consumer bindings
remain consumer authority.

Use a Campaign only when a destination spans sessions and material fog must be
revisited. It links the frontier, work, evidence, learning, and decisions while
their existing owners retain authority; see [ADR-0002](../../../docs/adr/0002-campaigns-for-bounded-uncertainty.md).

## Start with evidence

Run the read-only survey from the repository root:

```bash
python3.12 .codex/skills/maintain-repo-kit/scripts/survey.py
```

Use `--base` or `--consumer-parent` only when defaults are wrong. The survey
classifies evidence; it never authorizes a mutation. Inspect exact commits,
diffs, ownership, and checks. Stop on relevant dirt, missing refs, or ambiguous
authorship. The survey compares consumer files with committed kit revisions;
staged and unstaged kit edits are excluded. Rendered outputs are listed as
unassessed, not unchanged: reconcile their consumer-owned bindings separately.
Unavailable provenance produces an incomplete survey and a nonzero exit.

## Reconcile one flow at a time

### Local branches and worktrees

1. Classify each branch as base, ahead, behind, or diverged.
2. Review the exact range and run gates; prefer fast-forward for ahead-only.
3. Reconstruct both intents before proposing a merge or rebase.
4. Remove a worktree or branch only after clean/merged proof or explicit
   abandonment.
5. Re-run the survey after each mutation.

Merges, rebases, deletion, worktree removal, tagging, and pushing are separately
approval-gated. Never infer push or deletion authority from review or merge.

### Downstream refinements

Compare each consumer against the `_commit` in `.copier-answers.yml`:

- a managed-file delta relative to `_commit` is a portable-change candidate;
- a skipped/seeded delta may be portable or repository policy and needs semantic
  classification;
- a difference from current kit alone is update lag, not downstream authorship;
- a consumer-only skill is not automatically a kit candidate.

For a portable Candidate, identify its commit and rationale, recreate the
minimal change in its product owner (`skills/` or `template/`), and verify it here.
Never copy a dirty snapshot.
Keep local vocabulary, paths, authority, and source identity downstream.

Use the [migration handoff](references/migration-handoff.md) before a future
release or consumer update. Consumer propagation is a separate, approval-gated
operation. Tags are preferred checkpoints, but the recorded `_commit` is the
actual reconciliation baseline.

### External upstreams

Read [upstreams.md](references/upstreams.md). Fetch into a temporary directory,
record the reviewed commit, and compare behavior rather than filenames.

Classify each finding as:

- `adopt` — closes a demonstrated local gap;
- `adapt` — useful but must preserve local doctrine or tool constraints;
- `watch` — promising, with no current local need;
- `reject` — violates safety, authority, or simplicity boundaries;
- `already-covered` — no change needed.

Record source, local evidence, affected paths, semantic delta, risk, and a
recommendation. Preserve attribution for adopted work.

## Grill only decisions

Resolve facts from repositories. For remaining policy choices, use `grilling`:

1. Present a compact triage table before any question.
2. Ask only the unblocked decision frontier, with a recommended answer and the
   cost of the main alternative.
3. Defer dependent questions.
4. Follow `grilling` for decision locks; preserve separately required action
   approvals.

Conflicting intent, authority changes, and workflow defaults are decisions.

## Completion

Finish with:

- the post-operation survey;
- verification commands and results;
- absorbed refs and retained refs;
- downstream candidates with source commits;
- external findings with reviewed commits and dispositions;
- explicit unresolved decisions and the next approval-gated action.
