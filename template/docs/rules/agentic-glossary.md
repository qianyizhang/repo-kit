---
description: Portable agent-collaboration vocabulary — the register for directing an agent through work (control loop, coordination, epistemic honesty, craft).
scope: agent-collaboration glossary
status: stable
last_update: 2026-09-12
document_class: coordination
---

# Agentic glossary

Portable vocabulary for **directing an agent through work** — the words that make
human↔agent coordination precise. Kit-owned doctrine (promoted via
`governance-sync`), nothing here names a domain concept.

Sibling to [`skill-glossary.md`](skill-glossary.md): that sheet is for skill
**authors** (levers on predictability); this one is for anyone **driving a task**.
Where they touch, that sheet owns the term — see **Pointers** below.

Format: fuller than a one-liner because agent-facing terms must be *invocable* —
each row says what the term is, how to reach for it, and the misuse to avoid.
Repo-specific mode names and completion rungs stay in their repository binding;
this sheet defines only the portable concepts.

## Control loop

How a single task is driven from ask to committed change.

| Term | Meaning (why it exists) | How to invoke | _Avoid_ |
| --- | --- | --- | --- |
| **Lock** / **numbered lock** | A decision the user has **frozen**, optionally numbered for later reference. Turns direction into commitment. | Follow the acceptance and clarification rule in [grilling](../../.codex/skills/grilling/SKILL.md#frontier-batch-loop-default). | Confusing a decision lock with authorization for a separate action. |
| **Grill** | A decision-interview: stress-test a plan with pointed questions *before* implementing. The `grilling` primitive. | User says "grill me", or a plan has ≥1 unresolved decision. Ground every question in the tree first. | Grilling from priors instead of from the actual repo state. |
| **Slice** | One **verifiable unit** of work carved from a larger goal, sized to land and check independently. The `next-slice` skill picks one. | "What's the next slice?" → rank value, propose one testable slice. | Shipping a whole epic as one unreviewable change. |
| **Checkpoint** | A mid-task **save of state** when you can't finish — the honest alternative to faking completion. Pairs with *full means full*. | Can't finish → write what's done, what's left, where you stopped. | Relabeling a partial run as done instead of checkpointing. |
| **Decision memo** | The artifact for an options decision: `evidence → reasoning → tradeoffs → caveat → recommendation → open questions`. | Architecture / prioritization / "which approach" questions. | A recommendation with no evidence or tradeoffs shown. |
| **Intent restatement** | A one-sentence paraphrase of an ambiguous ask, naming the apparent outcome, opened *before* acting so the user can correct wording. | Any non-trivial or ambiguous request. Skip when already simple. | Restating trivially-clear requests (adds noise). |

## Coordination

Carrying work across sessions and across agents.

| Term | Meaning (why it exists) | How to invoke | _Avoid_ |
| --- | --- | --- | --- |
| **Handoff** | A durable transfer that lets another session/agent continue **without chat memory**. The `handoff` skill; modes: *session*, *parallel*. | When transferring work to another session or agent, or when continuity is at risk. | Continuing past a degraded window instead of cutting a handoff. |
| **Packet** | The self-contained **payload** of a handoff (session packet) or a claim (parallel). Minimal exported context — enough to resume, no more. | Assemble the packet at the stop point; keep it minimal and grounded. | Fat packets that re-export the whole conversation. |
| **Ledger** | An **append-only** record on a work item (Implementation Ledger) or claims (claim ledger). Findings/decisions/deviations go here, not only chat. | Append at each material step; set terminal status at the stop condition. | Overwriting history, or leaving findings only in chat. |
| **Integrator** | The **single session that merges** parallel writers' output. One owner merges; the rest only claim and write. | Multiple writers on shared paths → name one integrator up front. | Two sessions merging the same tree. |
| **Single-writer** | The invariant: **one owner per claimed surface** at a time. What makes parallel work safe. | Parallel mode → one claim ledger, one owner per surface. | Two agents editing one file/surface concurrently. |
| **Field-notes** | Short post-task notes proposing improvements to a **skill** you just used (the skill field-notes loop). | Record a demonstrated reusable defect or material unresolved issue in its existing owner. | Silent frustration with a skill; drift instead of upstream fix. |

## Epistemic honesty

Naming the register you're in, and not overstating where the work stands.

| Term | Meaning (why it exists) | How to invoke | _Avoid_ |
| --- | --- | --- | --- |
| **Mode** | The **epistemic register** a task runs in; named because it changes what authority you have. | Use the repository's named modes when it defines them; state material transitions. | Silently drifting from audit into fixing, or research into deciding. |
| **Altitude** | The **abstraction level** you're working at; "raise/lower altitude" moves between overview and detail. | Match altitude to the artifact; call the shift when you change it. | Mixing altitudes in one artifact (spec prose next to line edits). |
| **Done ladder** / **rung** | "Done" may be **graded**; each repository-defined rung is a stricter bar. | Name the concrete rung or proof reached; never imply a higher one. | Collapsing local verification, release, and deployment into one claim. |
| **Faithful** | **Extract/strip only** — no rewrite, no synthesis. The FAITHFUL-mode virtue and the standard for raw source payloads. | Fetch / curate / "download" → preserve verbatim, strip only web noise. | Calling a rewrite or summary "faithful". |
| **Corpus-silent** | A finding/candidate the **source never states** (e.g. an agent-proposed patch). Must stay a *candidate* pending human review. | Surface it as a candidate with provenance; never fold into the SSOT silently. | Adopting a corpus-silent claim as if the source said it. |
| **Full means full** | Asked to complete/verify **coverage** → do the real work (re-extract, recount). Can't finish → say so and checkpoint. | Extend/verify/"full" tasks → actual re-derivation, then verify. | Relabeling a partial run as "full" or softening the definition to fit. |

## Craft register

Cross-cutting engineering idiom agents lean on; ambiguity here is costly.

| Term | Meaning (why it exists) | How to invoke | _Avoid_ |
| --- | --- | --- | --- |
| **Seam** | A **deliberate boundary where behaviour can be altered or work divided** (a reserved code hook, a cross-language contract, a doc that splits along its seams). | Cut new work / tests / claims *at* a seam; add a reserved seam for latent routing. | Cutting *across* a seam — entangling two concerns that should stay separable. |
| **Spine** | The **load-bearing through-line** everything else hangs off (coordination spine, terminology spine, engine spine). | Route to the spine; keep leaves pointing at it. | Duplicating spine content into leaves (drift). |
| **Shim** | A backward-compat adapter kept **only for a real external caller**. Doctrine: *no shims* after an accepted pivot. | Keep one only when a concrete caller needs it; otherwise remove. | Shim theater — dead aliases/routes nobody calls. |
| **Scaffolding** | Temporary structure to reach a result, **removed after**. | Build it to get unblocked; delete it when the result stands. | Leaving scaffolding in as if it were the deliverable. |
| **Guardrail** | A constraint that keeps work **inside safe bounds** (a lint gate, a boundary invariant, a paired positive route). | Add one where a class of mistake recurs. | A bare "don't…" with no positive route (negation backfires). |
| **Barrier** | A **synchronization point** where parallel work must all complete before proceeding (vs. a pipeline that flows item-by-item). | Use only when a step genuinely needs *all* prior results at once. | A barrier where a pipeline would do — wasted wall-clock. |
| **Backstop** | A far-set safety limit that only fires on **runaway** (a cap you don't expect to hit). | Set it well above any real run; log if it ever trips. | Treating a backstop as a normal operating limit. |
| **Primitive** | A minimal **reusable building block** invoked by higher skills (the `grilling` primitive). | Compose from primitives; don't reimplement one inline. | Forking a primitive's logic into a caller. |
| **Load-bearing** | A thing others **structurally depend on**; changing it breaks them (symlinks are load-bearing). | Verify dependents before touching it. | `rm`/bulk-editing near load-bearing links without checking targets. |
| **Fan-out** | Spawning **parallel** workers/searches over independent items. | Independent work-list → fan out; recombine at a barrier if needed. | Fanning out coupled work that needed serial order. |
| **Backfill** | Retroactively **fill a gap** in a record/glossary/coverage that should already have been there. | Term/coverage exists in code but not the spine → backfill it. | Backfilling as a substitute for keeping the spine current. |

## Pointers (owned elsewhere — do not redefine)

These belong to another SSOT; this sheet links, never forks them.

| Term | Owner |
| --- | --- |
| **Frontier**, **Frontier batch**, **Context hygiene** | [`skill-glossary.md`](skill-glossary.md) §Coordination |
| **Leading word**, **Progressive disclosure**, **Completion criterion** | [`skill-glossary.md`](skill-glossary.md) |
| **SSOT** (single source of truth) | `docs/index.md` Authority by concern · [`skill-glossary.md`](skill-glossary.md) §Pruning |
| **Core model** | [`governance.md`](governance.md) §Scoped authority and core models · repository instance in `CLAUDE.md` or `docs/models.md` · `.codex/skills/domain-modeling/references/MODEL-NOTATION.md` mechanics |
| **Campaign** | [`governance.md`](governance.md) §Campaigns · [`doc.md`](doc.md) §Campaign records |
| **Provenance**, **Witness** | domain — the repo's glossary (`docs/glossary/`) + product SSOT |
| **Fail-closed** / **fail-open** | [`governance.md`](governance.md) §Agent toolchains and symlinks · [`doc.md`](doc.md) §Frontmatter and classes |
| Repository-specific mode names and done-ladder rungs | `CLAUDE.md` or another owning repository binding |
