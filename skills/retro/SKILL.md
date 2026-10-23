---
name: retro
description: "Conduct a retrospective on a coding session."
disable-model-invocation: true
---

# Retrospective

Find improvements to the agent environment from recorded work. A retrospective
produces ranked candidates; implementation follows only when the user authorizes
it. Keep completed fixes, current defects and proposed improvements distinct.

## Review the evidence

1. Load `writing-for-agents` through the available skill mechanism, or read its
   `SKILL.md` directly.
2. Read primary sources for the requested sessions. Default to this session when
   none is named. Start with bounded summaries, then inspect the messages, actions
   and results needed to support each finding. Report coverage and gaps.
3. Check current owners and verification commands before proposing a change.
   Historical failures may already be fixed. A repeated manual workaround may
   indicate an existing check is unwired rather than a new rule is needed.

## Find candidates

- **Navigation:** repeated searches, hidden dependencies or stale routing. Add a
  conditional pointer to the existing owner when it would prevent that search.
- **Checks:** inspect build/lint/test scripts, active hooks and CI. Missing coverage
  or a silently bypassed check is a finding. Mechanical rules belong in deterministic
  checks; recommend the smallest existing enforcement boundary.
- **Review:** inspect the changed behavior and affected callers, not only the diff.
  A reviewer needs the task, local contracts and enough surrounding code to assess
  failure paths. Reserve review prose for judgment that checks cannot replace.
- **Instructions:** compare loaded defaults, repository bindings and invoked skills.
  Find conflicting actions, duplicate ownership, stale instructions and no-ops.
  Preserve purposeful routing and product-specific exceptions. Put a condition
  beside the action it governs instead of adding another override document.
- **Automatic work:** identify implicit scans, delegation, retries, retained data,
  persistent goals or installation work disproportionate to the request. Check
  whether trigger, scope, cost and stopping condition were established upfront.
- **Tool economy:** inspect expensive calls and truncated output. Prefer narrow
  queries, explicit selected context and lazy payload reads. Measure only what the
  evidence supports; call counts alone do not establish wasted effort.
- **Information access:** identify missing logs, runtime identity or read-only
  access that prevented a diagnosis. Reuse existing tooling before adding a service.

## Present and stop

Rank candidates by consequence and recurrence. For each, state the observed
trigger, evidence, current status, smallest useful fix, owning file/tool and how
to verify it. Label inferred causes and uncertain benefits. If implementation is
authorized, build mechanical checks rather than merely documenting their rules.

Use existing instruction owners: `AGENTS.md` for short routing and shared defaults,
guides for judgment, skills for procedures, repositories for product meaning, and
code/config/tests for executable constraints. Follow repository mappings instead
of creating `CODING_STANDARDS.md` or another report ledger by default.
