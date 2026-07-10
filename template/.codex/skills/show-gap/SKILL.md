---
name: show-gap
version: "0.6.0"
description: >-
  Map a fuzzy or emerging feature intent against what the repo already built,
  planned, rejected, or deferred; discuss concrete shapes, then deliver an
  evidence-backed fit report, implementation-ready spec, or canceled memo.
  Use for feature gap/status/fit questions before implementation.
scope: repo feature gap analysis skill
status: experimental
last_update: 2026-07-10
---

# Show Gap

> Seeded from the governance kit. Fill in your repo's tracks, authority
> boundaries, and maturity levels on the first run; those edits are repo-owned.

Turn "I vaguely want X" into a repo-grounded understanding and, when it
converges, a spec. The artifact is the conversation-shaped decision record — a
fit report, then an implementation spec or a canceled memo. Code is not an output
of this skill.

## Operating contract

- **Discovery/specification first.** Even when the discussion turns concrete, stop
  at the accepted spec/plan. Implementation is a separate, explicit user switch;
  phrase the handoff as "I can turn this into an implementation now, but the
  show-gap artifact is the spec below." If the user says "build this" before a
  real spec exists, restate the spec you are about to implement and confirm.
- **Assume the initial wording is incomplete.** Use repo evidence to surface
  options, tradeoffs, and likely shapes before locking goal/non-goals. A run that
  ends with only a goal, non-goals, scope split, and open questions is a success.
- **Show the feature before specifying it** — lightweight sketches, concrete
  scenarios, data flows, sample surfaces, copy examples.

## Ground rules

- Start at `CLAUDE.md`, then `docs/index.md` as the navigator; never rely on
  memory for runnable/stubbed status. `docs/todo/backlog.md` owns the lifecycle;
  durable active and terminal records live under `docs/todo/items/`.
  `docs/deprecated/` is history, never authority.
- **Keep the repo's governing invariant intact.** Whatever `CLAUDE.md` declares as
  the backbone/authority contract (a deterministic spine, a review gate, a safety
  floor) is not weakened by a demo, narrative, or user-facing construct. Rendering,
  orchestration, and durable domain state have separate ownership — respect it.
- **Separate the likely track early.** A feature usually lands on one of:
  user-facing surface / narrative, demo or prototype, durable domain-model change,
  or governance/authority. A narrative or user-end surface can be valid without
  committing to durable domain behavior; a durable model change must map to the
  repo's module boundaries, glossary terms, tests, and authority rules.
- Prefer a light survey first; read full bodies only for the few docs/files that
  are direct candidates for authority or conflict.
- **Check every new noun against the glossary.** The moment the user (or you)
  introduces a domain word, grep `docs/glossary/` before adopting it. Catch (a) a
  *collision* — the word already means something else; and (b) a *better name
  exists*. **Be blunt**: propose the cleaner name directly rather than quietly
  adopting their wording; ubiquitous language is load-bearing and naming drift is
  a real defect.
- When the discussion settles, propose refinements to this skill from friction
  actually hit — as general rules, not hidden requirements. Don't interrupt
  discovery for it.

## Workflow

### 1. Capture the intent

Restate the user's feature in one concrete sentence and list likely aliases.
Preserve uncertainty; do not sharpen scope prematurely.

```text
Intent: help users <feature outcome> using existing repo outputs where possible.
Aliases: <domain term>, <UI wording>, <backlog wording>, <class/API name>,
<deprecated name>, <stakeholder phrase>.
```

### 2. Lightweight survey

Search these surfaces first, using aliases from step 1 (adjust the code dirs to
your repo):

```bash
rg -n "<alias-regex>" docs <code-dirs> .codex/skills -S
sed -n '1,280p' docs/index.md
sed -n '1,220p' docs/todo/backlog.md
find docs/todo/items -maxdepth 1 -name '*.md' -print | sort
rg -n '^work_status:|\*\*Review:\*\* (pending|audit-requested)' docs/todo/items
```

Then open only the directly relevant bodies, including each relevant item's
Status History and Implementation Ledger. Common anchors:

- `docs/index.md` for current status, tracks, and SSOT routing.
- `docs/glossary/*.md` for term authority.
- `docs/design/*.md` for active forward specs.
- Envisioning/philosophy docs (if the repo keeps them) for the *why* — often the
  single most reframing read for a fuzzy feature. These are non-authoritative
  (envision from them, contract from the SSOT); grep the relevant section and read
  that slice, not the whole file.
- `docs/deprecated/*.md` only to recover prior rationale.
- Owning module READMEs and the live UI/API code when the feature is visible.

Classify evidence as:

| State | Meaning |
| --- | --- |
| `already_built` | Runnable/live or shaped enough that the requested thing mostly exists. |
| `on_map` | Open backlog/design work directly covers it. |
| `overlap` | Adjacent work exists; this intent should merge, split, or re-scope. |
| `rejected_or_deprecated` | A durable item or prior decision is canceled/rejected/superseded, or history moved under deprecated docs. |
| `new_gap` | No direct coverage found after the light survey. |
| `blocked` | Direction is plausible but a named dependency or authority decision blocks it. |
| `deferred_by_design` | Intentionally out of the current cut — not an obstacle, a choice. Distinguish from `blocked`: nothing is stuck. |

Verdicts **stack** — the honest answer is often compound. Report all that apply
rather than forcing one label.

### 3. Fit the track and authority

Answer these before proposing:

- **Primary drive:** stakeholder understanding, product surface, demo/look,
  durable model, governance, or a staged split?
- **Authority:** Is the output representation material, durable policy,
  user-facing instruction, operational workflow, or test fixture?
- **Domain home:** If durable behavior is needed, which module/bounded context
  owns it? Which layer only renders, adapts, or demonstrates it?
- **Boundary:** Could the feature cross a safety/authority boundary the repo
  declares? If yes, route to review or keep it as non-authoritative draft.
- **Maturity target:** what is the honest next step (a prototype, a shaped slice,
  a fully live capability)? Do not force "live" when a shaped slice is right.

### 4. Envision before locking

Before writing an implementation spec, produce one or more concrete feature
shapes — elicitation tools, not commitments.

```text
Source of truth
<existing model/output/doc/backlog item/API>

Projection or user surface
<screen/report/workflow/story> -> <user action/decision> -> <trace/review path>
```

For each shape, state: what the user would see; which repo outputs it reuses;
which parts are fixture/prototype; which parts would require durable domain,
persistence, governance, or UI work later; and why this shape is useful or
misleading. If the user corrects the framing, update **Locked Decisions** and
continue — do not jump to implementation because the feature now sounds clear.

## Grill the decisions

Ask only the questions needed to choose scope — usually 3-6, phrased as decisions
(not abstract prompts), each with your recommended answer. After answers, record
**Locked Decisions** and **Still Open**; "user answered the grill questions" is
not "requirements are locked". A late answer that adds a *first-class noun*
ripples through domain placement, glossary, safety, and the plan — re-run step 3
and the glossary check rather than stapling it onto the existing spec.

Reusable decision axes:

1. Is the first win a visible product surface, a durable domain model change, or a
   governance decision?
2. Is the artifact meant to convince stakeholders, guide builders, probe a model,
   or become production behavior?
3. Should v1 prove one deep example, cover broadly but shallowly, or cut a thin
   vertical path?
4. Who is the audience: end user, operator, reviewer, internal builder, or mixed?
5. What evidence must be visible: human rationale, source citations, technical
   traces, screenshots, fixtures, tests, or backlog links?
6. Which output is most valuable now: goal/non-goal, visual concept, decision
   memo, implementation spec, or canceled memo?

## Draft report shape

```markdown
**Verdict**
<already built / on map / overlap / new gap / blocked, with one sentence>

**Evidence**
| Surface | What exists | Fit |
| --- | --- | --- |

**Interpretation**
<reasoning about surface vs durable model, authority, and domain ownership>

**Proposal Options**
| Option | Build | Pros | Tradeoffs | Best when |
| --- | --- | --- | --- | --- |

**Must Lock Now**
- <decision>

**Can Defer**
- <decision>

**Caveats / Open Questions**
- <risk or question, or None>
```

## Final deliverables

After discussion converges, produce exactly one of **implementation spec** or
**canceled feature memo**. Contents, the `produced_by` stamp rule, and the
spec→build handoff live in `references/deliverables.md` — open it only when a run
reaches that point.

## Pitfalls

- Collapsing broad product intent into the narrowest technical interpretation.
  Preserve adjacent concerns — education, monitoring, workflow, review, safety,
  provenance, user comprehension — until the user explicitly scopes them out.
