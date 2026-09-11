---
name: doc-hygiene-audit
version: "1.5.0"
description: >-
  Preserve engineering knowledge, reconcile drift, and remove spent documentation
  and comments. Use after pivots/refactors or for documentation hygiene.
scope: documentation hygiene skill
status: stable
last_update: 2026-09-11
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

For inspection or review requests, keep the audit read-only and report proposed
repairs. Apply repairs when the user requests fixes or has already authorized
them; do not ask again for the same scope. Owner decisions remain subject to
the apply/propose boundary below.

## Scope and checks

Default to the affected area, its owning authorities, and linked dependants.
Use a corpus-wide sweep when requested or when evidence shows cross-area drift;
state any expansion and why. Follow the configured corpus exclusions for generated
or historical material; inspect such evidence when needed without treating it as
an editable current authority.

Run the repository's configured documentation check first, checking its write
footprint for a read-only audit. Report mechanical failures, or fix them within
the authorized scope. The checker gates mechanical compliance; the agent judges
meaning against owning authorities and evidence. Use capture and reconciliation
within scope; review unresolved decisions and restructure only when warranted.

## 1. Capture

First ask whether the nearest existing code, schema, test, comment, or evidence
already preserves the knowledge adequately. Keep useful local explanations there;
do not manufacture a prose copy. Route knowledge only when its present home is
insufficient or is about to be removed:

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

Inspect maintained documentation surfaces within scope for:

- deprecated vocabulary and supersession links;
- contradictions with the authority for the specific concern;
- status or lifecycle claims that disagree with actual use;
- code-to-doc or contract-to-doc drift;
- skill prose that duplicates portable doctrine or embeds local bindings;
- active documents that merely redirect readers to a newer authority;
- READMEs and guides mirroring code inventories, results, or session state;
- comments that narrate obvious code, contradict it, or retain spent deferrals.

Read linked owners before changing a claim. An accepted invariant can expose a
code defect; never erase it merely to agree with the implementation. Preserve
local rationale, API obligations, constraints, and test intent when trimming
comments. Apply `docs/rules/doc.md` to superseded material after checking its
remaining purpose and dependencies.

## 3. Review implementation intelligence

When scoped records contain unresolved decisions, deviations, disputed
assumptions, repeated verification failures, or residual work, check whether
these are already reflected in their owning authority or an existing work item.
Do not reopen settled decisions merely because their history remains recorded.

For unresolved events, present evidence, consequence, recommended action, and
any owner decision needed. Recommend promotion, further audit, correction,
bounded reversal, or deferral in plain language as appropriate. Never auto-ratify
an unresolved choice, change an authority boundary, or perform a reversal as
hygiene; route these through owner decisions.

When promoting measured findings, preserve conditions, denominators,
completeness, uncertainty, and observation versus interpretation. Follow the
repository's evidence or experiment authority; documentation cleanup does not
establish a stronger result or authorize rerunning an experiment.

## 4. Reduce and close out

Apply the retention and removal rules in `docs/rules/doc.md` to completed records,
consumed handoffs, claim ledgers, and promotion receipts. Inspect incoming links,
IDs, catalogs, and evidence consumers before editing. Preserve protected revisions
and active operator state. Delete spent material within authorized cleanup scope;
archive only when the historical document has continuing value. Keep a compact
record when discovery or lineage still needs it.

When layout repeatedly causes drift, reduce the structure:

- consolidate duplicate or confusable homes;
- give a scattered concept one explicit owner and repoint dependants;
- split an oversized document along real authority seams;
- retire landed forward designs after promoting durable outcomes;
- keep active paths current without turning the archive into a second corpus
  of routinely retained execution notes.

Update `docs/index.md` only when a durable area or concept needs a route. Update
`CLAUDE.md` only when a project binding changes. Update checker configuration
when the enforced corpus boundary changes. A new file or directory does not by
itself require entries in all three.

## Apply versus propose

- **Apply within authorized repair scope:** mechanical repairs, factual and term
  corrections against established authority, capture of settled decisions into an
  existing owner, broken routes, and removal of spent material after the retention
  and dependency checks. An authorized cleanup includes these deletions unless
  the user or repository explicitly excludes them.
- **Propose unless already explicitly authorized:** choosing or changing a
  contract, unresolved trade-off or disposition, a new or moved SSOT,
  authority-boundary changes, or a bounded reversal. Correcting prose to match an
  established decision does not require choosing that decision again.
- Preserve repository-specific meaning in local bindings. Promote a portable
  doctrine improvement through the kit rather than patching one consumer copy.

## Completion and output

- Re-run the documentation check after edits and verify changed routes and claims
  against their owners. Report remaining check failures separately from semantic
  findings; a green checker alone does not establish semantic completeness.
- Resolve scoped findings or explicitly defer them with evidence and a concrete
  next action or review trigger. Cross-check existing work items before adding one.
- Report the scope inspected, omissions, changes or proposals, unresolved owner
  decisions, and verification. For removals, identify where unique meaning was
  preserved or why none remained. Label sampled or bounded coverage as such;
  fewer lines and a green checker alone do not establish a successful cleanup.

Return a concise result in conversation. Save a report only when requested or
when an authorized repair produces a durable finding, decision, or measurement
worth citing under `docs/rules/doc.md`; routine fixes and no-op audits need no
report file. When a report file is warranted, read
[references/report.md](references/report.md) for metadata and a minimal example.
