---
name: simplify-repository
description: Simplify a repository through evidence-backed pruning, deduplication and refactoring while preserving behavior. Use for repository cleanup, obsolete code/docs/dependencies/artifacts, or demonstrated architecture friction.
---

# Simplify repository

Reduce maintenance and reader burden, not merely line count. Prefer subtraction,
direct data flow and fewer concepts; retain abstractions or duplication that keep
callers simpler. **No justified change** is a valid result.

## Bound the cleanup

Identify the requested scope, owned changes and accepted behavior. Reuse current
session context and applicable check results. Inspect fresh worktree/staging state
and relevant repository instructions; follow entry points, scripts, CI and history
only as the affected paths require. Preserve unrelated work and staging.

Establish the contracts consumers rely on: interfaces, published content/URLs,
persisted data, compatibility, accessibility, security and provenance. A cleanup
request preserves these obligations. Resolve discoverable facts locally; ask only
about consequential choices or authority that remains unresolved.

## Choose an evidenced simplification

For each candidate, establish the concrete burden, affected consumers, smallest
useful change and verification. A small change needs no separate candidate list;
keep broader triage in the conversation or temporary workspace.

Before removal, trace actual use: imports/callers, dynamic discovery, configuration,
build/deployment, documentation links and external consumption. An empty search
or recovery from Git alone does not establish that removal is safe.

- **Code and dependencies:** check scripts, plugins and runtime/build use. Keep
  manifests and lockfiles consistent; preserve genuine test seams and domain rules.
- **Generated assets and evidence:** establish inputs, regeneration and consumers;
  retain unique measurements, active claims and explicit retention obligations.
  Follow the existing artifact owner rather than creating another archive.
- **Documents:** retain unique decisions, rationale, caveats and operating steps.
  Consolidate rules into their owner; leave readily discoverable configuration
  facts with executable configuration. Preserve licenses and attribution.

## Change and prove

Work in coherent, verifiable slices. Migrate callers to the retained owner, verify
that path, then remove obsolete internal code. Exported compatibility changes need
explicit authorization. Keep unrelated fixes, upgrades and formatting separate.

Judge a refactor by total interface cost and knowledge pushed onto callers, not
its shorter implementation. For substantial boundary changes, compare a direct
solution with a meaningfully different design; straightforward removal needs no
design exercise. Defer a speculative change whose benefit cannot be established.

Use existing behavioral checks, establishing characterization before structural
changes where coverage is missing. Preserve behavior-protecting tests; replace
construction-coupled assertions only with equivalent contract coverage. Verify
affected failure paths and consumers, not just a successful build. For generators,
compare meaningful regenerated output; for delivered content, check relevant
routes, references, rendering and packaging.

## Close and stop

Use `finish-work` for final review, required gates and authorized commits, reusing
this scope and evidence. If unavailable, review the final diff and run focused
checks plus required repository gates; report blockers and unverified boundaries.

Stop when the requested scope is covered or remaining candidates need new evidence
or authority. Report what became simpler, supporting checks and retained concerns.
Measure only the claimed benefit: file counts are not runtime or Git-history size.
Routine cleanup needs no permanent report or ledger.

[Sources and optional rationale](references/principles.md) retain attribution;
they add no mandatory workflow.
