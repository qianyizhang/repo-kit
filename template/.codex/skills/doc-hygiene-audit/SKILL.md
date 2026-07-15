---
name: doc-hygiene-audit
version: "1.2.1"
description: >-
  Keep the doc corpus honest: capture knowledge, reconcile drift, review
  implementation decisions/deviations with the user, and restructure when the
  layout causes drift. Use after pivots/refactors or for doc hygiene.
scope: documentation hygiene skill
status: stable
last_update: 2026-07-10
document_class: artifact
---

# Documentation Hygiene Round

> Seeded from the governance kit. This is a portable starter — sharpen its
> greps, routing table, and spine with your repo's real terms and paths on the
> first substantive run; those edits are repo-owned (the kit will not overwrite
> this file on update).

A round does four things, in order of leverage:

1. **Capture** emergent knowledge before it's buried — terms, settled decisions,
   and TODOs that live only in conversation, reports, PRs, or code comments get
   routed into their SSOT, glossary, or backlog.
2. **Reconcile** drift — stale/deprecated terms, cross-doc contradictions, status
   and deprecation-contract violations, code↔doc skew.
3. **Review implementation intelligence** — read backlog-item ledgers for
   material decisions, deviations, disputed assumptions, and audit requests;
   bring consequential dispositions to the user instead of silently ratifying
   or reversing them.
4. **Restructure** when the layout itself causes the drift — duplicate or
   homeless docs, oversized files, missing landing spots.

When a new SSOT or implemented code surface arrives, hygiene is expected to be
**decisive**: move superseded broad docs out of active paths instead of leaving
them beside the new authority with an overwrite banner. Active docs should be
small, current, and useful; historical detail belongs in `docs/deprecated/`.

Mechanical checks (frontmatter, trailer tokens, broken links, index coverage,
symlink layout) are owned by `scripts/check_docs.py` (run by `make lint` +
pre-commit). This skill is the **semantic** layer on top — don't re-derive its
checks by hand.

## When to run

- After an architecture pivot, model rename, or major refactor
- Before a release, or when `[hygiene]` backlog items pile up
- On request: "check the docs", "doc hygiene", "find conflicts"

## The corpus and its SSOT spine

`CLAUDE.md`'s *"Where things are documented"* list is the canonical SSOT spine —
**that list is itself the first thing to keep honest**: every pointer resolves,
nothing authoritative is missing. Derive the spine from it; don't trust a
hardcoded copy. Read the spine docs plus every module and app `README.md`.
Routing summaries (product/MVP docs) point at deeper SSOTs — follow their links
before treating a claim as current.

```bash
uv run python scripts/check_docs.py                        # mechanical preflight; fix these first
find docs .codex/skills -name '*.md' | sort                # all governed markdown (docs, SKILLs, deprecated)
find docs -name '*.html' | sort                            # maintained/stale-prone HTML (script skips these)
```

## 1. Capture — before it's buried

The highest-value part of a round. As you read, route every orphaned fact to its
home — don't just note it.

| You find… | Route to |
|:--|:--|
| A domain term not in the glossary | `docs/glossary/` (format per `docs/rules/doc.md`) |
| A settled decision living only in a report / PR / conversation | the owning design/architecture SSOT |
| A `TODO`/`HACK`/`WHY` deferral in code that's untracked | a new or existing `docs/todo/items/` record |
| A resolved or abandoned backlog item still marked open | that item's Status History + current `work_status` |
| An emerged concept with no doc home | propose a home (§3) |

Glossary discipline: a new domain term in code or docs earns a glossary entry in
the same round (`CLAUDE.md` ubiquitous-language rule).

## 2. Reconcile — drift sweep

One pass, several lenses.

**Skill-document pruning.** `docs/rules/skill.md` is the SSOT for skill authoring.
Include `.codex/skills/*/SKILL.md` in semantic hygiene: prune descriptions that
carry duplicate trigger branches, remove per-skill lifecycle prose already owned
by `docs/rules/skill.md`, convert dated field-note sediment into timeless
pitfalls, and disclose branch-only reference into `references/*.md` when a skill
body buries the live steps.

**Stale/deprecated terms.** Don't hardcode the list — it rots. Derive the current
set from glossary entries marked deprecated, the "old → new" tables in
`docs/design/` handoff specs, and the previous hygiene report. Then grep md, py,
**and html** for the retired terms.

**Contradictions vs the spine.** Load-bearing claims that must read identically
everywhere: the governing invariant text, the module list/graph, scope /
out-of-scope, safety requirements. A divergence is a finding; align to the spine
(or the current ADR/module/design SSOTs).

**Status & deprecation contract.** Beyond the script's status-vs-folder check:
flag `experimental` docs that are effectively SSOT (and the reverse); confirm each
`docs/deprecated/*.md` carries a supersession note + active-SSOT link; confirm
active docs cite deprecated ones only as historical context, never as authority.
An active doc whose first real instruction is "ignore this, use X instead" is a
failed deprecation.

```bash
rg -n "docs/deprecated/" docs -g '!docs/deprecated/**'   # inspect framing of each hit
```

## 3. Review implementation intelligence

Scan `docs/todo/items/` for `pending` / `audit-requested` review states,
decisions not reflected in their owning SSOT, deviations that changed acceptance
or authority boundaries, assumptions contradicted by later evidence, repeated
verification failures, and `partial` items without valid residual work.

Classify each material event and present a **Decision Review Queue**:

| Disposition | Use when | Action |
|:--|:--|:--|
| `ratify` | Evidence supports the decision | ask the user to formally approve it; promote durable consequences to the owning SSOT/glossary/ADR; mark `ratified` only after approval |
| `audit-again` | Evidence is insufficient | create a linked audit item; mark `audit-requested` |
| `correct-forward` | The decision was wrong but forward repair is safer | create a linked remediation item; mark the old event `rejected` or `superseded` |
| `rewind` | Continuing compounds harm and reversal is justified | propose a bounded rewind plan with affected paths/data and verification; implement only after explicit approval |
| `defer` | Resolution is valid but not timely | create/link an item with a trigger condition; leave review visible |

Here `ratify` means formal user approval after review, not an agent deciding that
its own choice was correct. Prompt the user one material decision at a time with
evidence, consequence, and a recommended disposition. Do not auto-ratify a
semantic decision, rewrite an authority boundary, or perform a rewind as hygiene.
Mechanical stale-status repairs may still be applied when evidence is
unambiguous.

```markdown
| Item / event | Evidence | Consequence | Recommendation | User decision |
|:--|:--|:--|:--|:--|
| AB-AREA-001 / IL-002 | <proof> | <impact> | audit-again | pending |
```

## 4. Restructure — reduce cognitive load

When the same drift keeps recurring, the structure is the cause. Propose (or, for
low-risk moves, apply) structural fixes. Default to **clearing active paths**:
the active tree should show what to use now, not a pile of superseded context
with warning banners.

- **Duplicate/confusable locations** — near-identical paths invite mistakes;
  consolidate or rename.
- **Homeless topic** — a concept scattered across several docs wants one SSOT;
  create it and repoint.
- **Oversized doc** — a file doing too many jobs should split along its seams, or
  be archived wholesale once code/module READMEs/new SSOTs own the durable
  contracts.
- **Landed-spec lifecycle** (`docs/rules/doc.md`) — `docs/design/` is
  forward-only. A spec whose slice has shipped is residue: promote its durable
  contracts to their SSOT, then move the spec to `docs/deprecated/` with a
  supersession note. **Read the full body** — a spec can still carry a forward
  dependency (e.g. pending owner approval) that keeps it active.

Any new doc/dir gets frontmatter + a `CLAUDE.md` spine pointer and a navigator
index row in the same change.

### Active-summary standard

When replacing a bloated active doc with a short summary: frontmatter with
current `status`; one paragraph on what the page is for; explicit "current
authority" pointers; a small routing table; a link to the deprecated long-form
history; clear non-authority boundaries. Do not paste the old body below a
supersession banner.

## What to apply vs propose

- **Apply** in-round: mechanical fixes, term alignment, glossary/backlog-item capture,
  frontmatter, broken-link/path repair, low-risk structural moves, and clear
  deprecations where a new SSOT/code surface already owns the durable contract.
- **Propose** (don't auto-apply): anything that re-litigates a settled decision,
  changes meaning, or moves an SSOT whose replacement is not already explicit.
- Domain/policy *content* is never edited here — this skill governs docs.
- **Kit-owned doctrine** (`docs/rules/*`, the two scripts, `ruff_base.toml`,
  `AGENTS.md`) comes from the shared governance kit. A project-agnostic
  refinement is promoted upstream — patch the kit, `copier update` (the
  `governance-sync` skill) — not edited only here; move the project-specific
  half into `CLAUDE.md` bindings. A local edit to a kit-owned file is drift
  (`docs/rules/governance.md` "Kit propagation").

## Output

A round closes with the changes landed and a short report of what's left to
decide. Write it to `docs/reports/doc-hygiene-YYYY-MM-DD.md` with standard
frontmatter **including a `produced_by:` stamp**
(`doc-hygiene-audit@<version> · agent=<model-id> · effort=<level> · <date>`), as
a table — every row a concrete action, not a bare observation:

```markdown
| # | Category | File:Line | Finding | Action |
|:--|:--|:--|:--|:--|
| 1 | captured      | items/AB-HYG-001.md | untracked TODO in rules/engine.py | created [hygiene] item |
| 2 | stale_term    | review/README.md:41 | old term                          | → new term (applied) |
| 3 | contradiction | prd vs README       | module list differs               | align owning README |
| 4 | structure     | docs/report{,s}/    | duplicate dirs                    | propose: merge |
```

Cross-check against existing `[hygiene]` backlog items and implementation ledgers
— extend, don't duplicate. Include the Decision Review Queue in the report when
material dispositions remain for the user.

## Pitfalls

- Skipping module READMEs and HTML docs — the most common stale-term homes.
- Trusting frontmatter to call a spec landed. `check_docs.py` couples
  `status: deprecated` to `docs/deprecated/`; only a full-body read catches a
  forward dependency that keeps a spec active.
- Treating a logged implementation decision as ratified authority. Only the user
  or the owning formal review process can ratify it.
