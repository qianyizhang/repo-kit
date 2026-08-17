---
name: doc-hygiene-audit
version: "1.3.0"
description: >-
  Keep the doc corpus honest: capture knowledge, reconcile drift, review
  implementation intelligence with the user, and restructure when layout causes
  confusion. Use after pivots/refactors or for documentation hygiene.
scope: documentation hygiene skill
status: stable
last_update: 2026-08-17
document_class: artifact
---

# Documentation Hygiene Audit

This is the semantic layer over the repository's mechanical documentation
checks. Start from the local boundaries instead of assuming one global spine:

- `CLAUDE.md` binds project identity, invariants, authorities, and commands.
- `docs/index.md` is a compact area and concept navigator, not a file inventory.
- Authority belongs to the owner of each concern: code, contract, schema, ADR,
  glossary, rule, or other explicit SSOT.
- `docs/rules/doc.md` owns documentation classes and lifecycle.
- `scripts/check_docs.py` and repository configuration own mechanical checks.

Do not re-derive checker rules by hand or encode repository-specific facts in
this managed skill core.

## When to run

- After an architecture pivot, model rename, or substantial refactor
- Before release, or when documentation debt accumulates
- On request: "check the docs", "doc hygiene", or "find conflicts"

Run the repository's configured documentation check first. Fix clear mechanical
failures, then perform these four semantic passes.

## 1. Capture

Route knowledge that otherwise exists only in conversation, implementation,
reports, or comments:

| Finding | Destination |
|:--|:--|
| New domain term | Owning glossary |
| Settled trade-off | Owning ADR or design authority |
| Current cross-surface contract | Owning contract, schema, code, or README |
| Durable unfinished work | Existing or new work-item record |
| New concept with no clear owner | Propose an owner; do not invent one silently |

Link evidence rather than copying it. A work item or report must not become a
shadow architecture source.

## 2. Reconcile

Sweep governed Markdown and other maintained documentation surfaces for:

- deprecated vocabulary and supersession links;
- contradictions with the authority for the specific concern;
- status or lifecycle claims that disagree with actual use;
- code-to-doc or contract-to-doc drift;
- skill prose that duplicates portable doctrine or embeds local bindings;
- active documents that merely redirect readers to a newer authority.

Read linked owners before changing a claim. When a new authority clearly
supersedes a broad active document, promote any remaining durable content and
move history out of active paths according to `docs/rules/doc.md`.

## 3. Review implementation intelligence

Inspect durable work records for decisions, deviations, disputed assumptions,
repeated verification failures, residual work, and review requests not yet
reflected in their owning authority.

For each material event, recommend one disposition:

| Disposition | Meaning |
|:--|:--|
| `ratify` | Evidence supports formal owner approval and promotion |
| `audit-again` | Evidence is insufficient; open a bounded audit |
| `correct-forward` | Repair forward and preserve the rejected history |
| `rewind` | Propose a bounded reversal because continuation compounds harm |
| `defer` | Keep a visible trigger and linked residual item |

Present unresolved events as a Decision Review Queue with evidence,
consequence, recommendation, and owner decision. Never auto-ratify your own
choice, change an authority boundary, or perform a rewind as hygiene.

## 4. Restructure

When layout repeatedly causes drift, reduce the structure:

- consolidate duplicate or confusable homes;
- give a scattered concept one explicit owner and repoint dependants;
- split an oversized document along real authority seams;
- retire landed forward designs after promoting durable outcomes;
- keep active paths current and move superseded detail to the configured
  historical location.

Update `docs/index.md` only when a durable area or concept needs a route. Update
`CLAUDE.md` only when a project binding changes. Update checker configuration
when the enforced corpus boundary changes. A new file or directory does not by
itself require entries in all three.

## Apply versus propose

- **Apply:** mechanical repairs, clear term alignment, capture into an existing
  owner, broken routes, and low-risk structural cleanup with explicit authority.
- **Propose:** semantic changes, disputed dispositions, a new or moved SSOT,
  authority-boundary changes, rewinds, or any promotion requiring owner choice.
- Preserve repository-specific meaning in local bindings. Promote a portable
  doctrine improvement through the kit rather than patching one consumer copy.

## Output

Write a concise report to the repository's report area. Use a valid status
(`experimental`, `stable`, or `deprecated`) and exactly one report outcome:
`promoted`, `inconclusive`, or `archive_eligible`. The latter two require the
conditional fields defined by `docs/rules/doc.md` and enforced by
`scripts/check_docs.py`.

This example is checker-valid for a round awaiting owner decisions:

```markdown
---
description: Results of the documentation hygiene audit.
scope: documentation hygiene report
status: stable
last_update: YYYY-MM-DD
document_class: report
report_outcome: inconclusive
inconclusive_reason: Semantic authority decisions await owner review.
review_trigger: Owner resolves the Decision Review Queue.
produced_by: doc-hygiene-audit@<version> · agent=<model-id> · effort=<level> · YYYY-MM-DD
---

# Documentation hygiene report

| # | Category | Location | Finding | Action |
|:--|:--|:--|:--|:--|
| 1 | captured | `<path>` | `<knowledge at risk>` | `<routed or proposed>` |

## Decision Review Queue

| Event | Evidence | Consequence | Recommendation | Owner decision |
|:--|:--|:--|:--|:--|
| `<event>` | `<proof>` | `<impact>` | `audit-again` | pending |
```

Cross-check existing work items before creating new ones. Close the report with
what changed, what remains for the owner, and the verification performed.

## Pitfalls

- Treating an index or report as authority instead of following its route.
- Trusting frontmatter without reading whether a design still has forward work.
- Applying semantic or authority decisions without explicit owner approval.
- Keeping superseded explanations active beside the authority that replaced
  them.
