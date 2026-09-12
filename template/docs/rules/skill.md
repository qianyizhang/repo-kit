---
description: Rules for authoring, maintaining, and pruning agent skills under .codex/skills/.
scope: skill authoring rules
status: stable
last_update: 2026-09-12
document_class: coordination
---

# Skill rules

`CLAUDE.md` owns repository invocation policy; this file owns portable skill
authoring rules. `.codex/skills/` is the single home, and `docs/index.md`
§Main flows is the human-facing router. Bold terms are defined in
[`skill-glossary.md`](skill-glossary.md).

Write skills around outcomes, non-obvious knowledge, and necessary boundaries.
Predictability means consistent obligations and credible evidence; the approach
and output can vary with the task. Preserve exact sequences when their order
protects correctness, permissions, or a fragile operation. Shared skills may serve
different models: assess behavior on representative tasks before removing useful
guidance solely because one model appears to need less support.

Vocabulary adapted from mattpocock/skills `writing-great-skills`; task-sized
guidance informed by OpenAI's
[skills and prompts review](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).

## lifecycle

- **Versioned.** Semver `version:` in frontmatter, bumped in the same commit as
  any behaviour change: patch = fix/clarify, minor = new step/capability, major
  = incompatible contract/output. **Git history is the changelog** — no standing
  changelog section to rot. Where a skill ships code, a test guards the version
  against the package `__version__` (see `clinical-guideline-extraction`).
- **Signed output.** Any artifact a skill produces is stamped with its
  provenance — `skill@version · agent=<model-id> · effort=<reasoning level> ·
  <date>` — kept next to the artifact's metadata: docs in frontmatter
  (`produced_by:`), data runs in run metadata (`--run-id`, `--model`,
  `--effort`). Prefer stamps built from the package `__version__` over
  hand-typed ones — hand-typed stamps drift.
- **Field-notes loop.** Correct a demonstrated workflow defect within the
  authorized scope, or record a material unresolved issue in its existing owner.
  Promote reusable fixes through the kit. A transient inconvenience does not
  require a permanent rule, new backlog item, or extra completion gate.
- **Map re-sync.** A skill add, rename, or invocation-boundary change re-syncs
  `docs/index.md` §Main flows when routing changes. Internal behavior changes do
  not churn the navigator.

## description — the always-loaded trigger

The frontmatter `description` is available during skill selection. State the
capability and the request that needs it, in as few words as remain discriminating.
Include exclusions only to prevent likely misrouting. Move tool choices, mode
inventories, output formats, and internal caller mechanics into the body.

Classify invocation deliberately:

- **Model-invoked (agent-invokable):** a bounded, low-surprise workflow that
  directly answers a recognized request. Keep the description narrow enough that
  ordinary work does not accidentally match it. Front-load **leading words**;
  one trigger clause per genuine **branch**.
- **User-invoked (explicit-user only):** an interaction mode or substantial
  artifact workflow whose surprise/cost is material. Set
  `disable-model-invocation: true` in `SKILL.md` and
  `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. Description
  is a **human one-liner** (picker-oriented): strip "Use when…" trigger lists.
  The agent may suggest it; recognition is not consent.
- A mixed skill must state the bounded agent-invokable phase and the point that
  requires user intent. Prefer this over duplicating most of a workflow across
  two skills.
- Trade **context load** (more model-invoked descriptions) against **cognitive
  load** (more user-only names). When user-only skills multiply past memory,
  prefer a **Main flows** map in the navigator index; add a **router skill**
  only if humans still cannot find the path.

The two explicit-only controls are toolchain adapters for one policy and must
agree; `scripts/check_docs.py` rejects drift. User-invoked skills orchestrate
model-invokable disciplines, never another user-invoked skill. If a workflow
needs composition, extract the reusable discipline only when a real second
caller exists; do not create a wrapper/primitive pair speculatively.

## body

- **Progressive disclosure.** Keep purpose, shared constraints, completion, and
  relevant routing in the entrypoint. Move substantial branch-only procedures,
  templates, and references behind links that state when they apply. A short
  single-purpose skill needs no additional router or files.
- **Completion.** State the requested deliverable and the evidence that establishes
  it. Continue authorized work through applicable verification and necessary
  documentation. A helper skill returns to its caller when its contribution is
  complete; it does not end a larger authorized task. Preserve review-only and
  explicitly requested interview boundaries.
- **Incomplete work.** Name remaining work and the blocker or next action. Use a
  checkpoint when continuity is needed; hiding later steps or forcing a fresh
  context is not a substitute for a clear completion criterion.
- **Verification.** Use deterministic checks for the contracts they actually
  enforce and agent judgment for meaning. For this kit’s extended skill frontmatter,
  use `scripts/check_docs.py` through the repository’s supported Python command;
  a generic skill validator may reject valid repository metadata or require
  dependencies absent from that environment. Do not remove valid fields to fit
  a different schema. Choose checks by changed surface and
  required gates under `docs/rules/testing.md`; avoid routine repeat checks or
  tests that merely mirror the wording of instructions.
- **Authorization.** Reuse authorization already given. Ask only for material
  unresolved choices or actions outside that scope. Decision acceptance follows
  `grilling`; accepting a decision does not itself authorize a separate action.
- **Subagent durability.** Any fan-out contract tells subagents to write their
  output file first, then report, so a session cut leaves recoverable output.
- **Prohibitions are for hard rails only.** Safety/authority invariants stay as
  explicit "never" lines, each paired with the positive route ("route to
  `UNBOUND_LIBRARY`", "defer rather than guess"). Soft preferences are phrased
  as the target behaviour, not a "do not" (**negation** failure mode).

## pruning — on every edit round

- **Single source of truth.** A meaning lives once. Rules already owned by
  `CLAUDE.md` or `docs/rules/` are not restated per skill (no per-skill
  Versioning sections). The sanctioned exception is point-of-use operational
  text an agent needs mid-command (e.g. the restricted-sandbox venv fallback).
- **No-op test.** A line the model already obeys by default is deleted, not
  trimmed.
- **Sediment.** Pitfalls state the *current* rule, timeless, with a one-clause
  why; version stamps and dated run-log entries inside the body are a changelog
  in disguise — that history lives in git.
- **Sprawl.** When a body outgrows its live steps, disclose reference to
  `references/*.md` rather than letting the top of the skill bury them.

## managed portable skill cores

When a skill is reused across Copier-managed repositories, separate reusable
workflow from local authority:

- Keep the portable `SKILL.md`, general references, scripts, assets, validator,
  and UI metadata kit-owned.
- Keep repository language, paths, invariants, roles, vocabulary, source
  identity, and verification command in one explicitly skipped binding file.
- Make the skill read and validate that binding before acting. Fail closed on a
  missing, stale, or placeholder binding.
- Treat Copier `_skip_if_exists` as the ownership declaration: skip the binding,
  not the whole skill directory.
- Version the portable skill and the repository profile separately when both
  affect artifact provenance.

Avoid two sibling skills for “core” and “local” behavior; separate triggers make
it easy to load only half the contract. Avoid managed/local marker blocks inside
one file; they create fragile merge authority.
