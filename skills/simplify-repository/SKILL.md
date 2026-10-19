---
name: simplify-repository
description: Simplify an existing repository through evidence-based pruning, trimming, deduplication, and justified refactoring of code, documentation, dependencies, and artifacts. Use for requests to clean up a repo, remove dead or redundant material, reduce complexity or maintenance burden, or reconsider an overgrown architecture while preserving behavior. Do not use as permission to remove features, change public contracts, or perform unrelated rewrites.
---

# Simplify Repository

Optimize for lower maintenance and reader burden, not fewer lines. Prefer subtraction, direct data flow, and fewer concepts; retain useful duplication or abstraction when removing it would make callers harder to understand. A justified architectural change is in scope when it removes a demonstrated burden and can be verified.

## 1. Establish the boundary

- Read repository instructions, working-tree changes, entry points, scripts, CI/deployment configuration, and relevant recent history. Preserve unrelated user changes.
- Identify required behavior and contracts: public APIs and URLs, content, persisted formats, compatibility, accessibility, security, licenses, attribution, and provenance. Do not infer permission to change these from a cleanup request.
- Run or inspect existing checks before editing; record pre-existing failures. Establish characterization or equivalence checks before structural changes where coverage is missing.
- Investigate facts yourself. Ask only about unresolved consequential choices; do not turn a clear small cleanup into a questionnaire.

## 2. Find evidence, then choose

Make a short working list of candidates, evidence, expected maintenance benefit, and verification. Keep it in the conversation or temporary workspace unless a durable deliverable is requested. Start with high-confidence, low-risk changes.

Before deleting, establish the item's role and why it is safe to remove:
- Trace imports, callers, dynamic discovery, configuration, build/deploy paths, documentation links, and public consumption. An empty text search is evidence to investigate, not proof of non-use.
- For generated artifacts, verify the generator, inputs, repeatable regeneration, and consumer workflow. “Generated” does not mean disposable: retain unique measurements, historical records, provenance, or outputs that deployment still requires. Do not equate recoverability from version control with permission to delete.
- For documents, preserve unique decisions, rationale, caveats, operational instructions, and records. Consolidate repeated rules into one authoritative location; keep conditions beside their rules. Avoid copying changing configuration facts into prose unless the lookup benefit justifies upkeep.
- For dependencies, inspect scripts, plugins, transitive assumptions, and runtime/build use; update the appropriate manifest and lockfile together.

## 3. Simplify in coherent slices

- Remove obsolete or redundant material with proven replacements or no remaining obligations. Prefer existing framework/compiler facilities over custom parsing, serialization, helpers, wrappers, or parallel paths. Consolidate competing policy owners, even when the clearer boundary adds lines; audit all consumers, configuration, and test hooks.
- Migrate callers, verify the new path, then delete the old implementation. Apply this directly only to fully owned internal interfaces; preserve exported or external compatibility obligations unless a breaking migration is explicitly authorized.
- Judge abstractions by total interface cost: concepts, arguments, ordering, configuration, invariants, error handling, and knowledge pushed onto callers. Ask whether deleting an intermediary removes complexity or merely redistributes it. Retain genuine encapsulation, test seams, and differing domain rules.
- For a consequential architecture change, identify the concrete hotspot and compare a direct solution with a meaningfully different boundary. Choose the simplest approach supported by current needs; avoid speculative future reuse. Do not impose a design exercise on a straightforward deletion.
- Preserve behavior-protecting tests; replace implementation-coupled tests only after mapping their coverage to equivalent boundary checks. Do not remove checks merely because the refactor makes them fail.
- Keep bug fixes, feature changes, formatting churn, and dependency upgrades separate unless required for the requested simplification; raise material scope changes before proceeding.

## 4. Verify and stop

- Review the diff for accidental behavior, contract, content, provenance, or security changes. Recheck references and consumers after removals.
- Run targeted tests and the repository's relevant type, lint, build, and integration checks; exercise affected runtime behavior. For content or assets, verify published routes, fragments, links, rendering, and packaging as applicable. For lifecycle changes, check first paint, navigation, disposal, and no-JavaScript behavior where supported. Test affected preview/build modes and real environment boundaries such as temporary filesystems; local unit tests alone may miss them. For generators, regenerate and compare meaningful outputs, isolating nondeterministic metadata explicitly.
- Distinguish passing checks, pre-existing failures, environment blockers, and checks not run. Never claim equivalence solely from a successful build or reduced line count. Distinguish file/line counts and checkout bytes from repository-history size, runtime cost, and deployed bytes; measure the benefit actually claimed.
- Roll back or defer a speculative slice whose benefit or safety cannot be established. Stop when the requested scope is covered, remaining candidates need new authority or missing evidence, or further edits merely move complexity around. Do not manufacture cleanup work to meet a deletion target.
- Report briefly: what became simpler, what evidence/checks support it, and any important retained candidates or blockers. Create no permanent cleanup report or extra documentation by default.

For upstream rationale and optional deeper reading, consult [references/principles.md](references/principles.md); the workflow above is self-contained.
