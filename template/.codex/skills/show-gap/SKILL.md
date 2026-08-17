---
name: show-gap
version: "0.11.0"
description: >-
  Fit fuzzy feature intent to built, planned, rejected, and deferred repository
  evidence. The bounded read-only audit may be agent-invoked; discussion and
  durable specification require clear user intent.
scope: repo feature gap analysis skill
status: experimental
last_update: 2026-08-17
document_class: artifact
---

# Show Gap

Turn “I vaguely want X” into a repo-grounded fit and, when discussion converges,
a Campaign seed, implementation spec, or canceled memo. Code is not an output.

Use `next-slice` for “what next?”, stale planning, or readiness questions. This
skill owns fuzzy feature intent.

An agent may invoke the initial evidence audit to prevent speculative work. Stop
after the fit report unless the user asks to explore options, answer the grill,
or produce a durable deliverable.

## Contract

- Discover before specifying. Implementation requires a separate explicit user
  switch.
- Treat the initial wording as incomplete. Surface likely shapes, options, and
  trade-offs before locking scope.
- Show the feature with a small scenario, sketch, or data flow before writing a
  detailed spec.
- Read repository authorities and live code before relying on remembered status.
- Preserve the repository's governing invariant and ownership boundaries.
- Check new nouns against the glossary and propose an existing canonical term
  when one fits.
- Read broadly only for routing; open full bodies for direct authorities and
  conflicts.

When the feature materially changes a relationship spanning several contracts
or ADRs, identify the core-model impact and route any accepted change through
`domain-modeling`. Local features need no model field.

## 1. Capture intent

Restate the desired outcome in one concrete sentence and list likely aliases
without sharpening uncertainty prematurely.

```text
Intent: help users <outcome> using existing repository outputs where possible.
Aliases: <domain term>, <UI wording>, <work-item wording>, <API name>,
<deprecated name>, <stakeholder phrase>.
```

## 2. Survey

Search the navigator, active Campaigns, work records, glossary, active designs,
live code, tests, and deprecated rationale using the aliases. Typical commands:

```bash
rg -n "<alias-regex>" docs records <code-dirs> .codex/skills -S
sed -n '1,240p' docs/index.md
sed -n '1,200p' records/work-items/backlog.md
rg --files records/work-items/items
rg -n '^work_status:|\*\*Review:\*\* (pending|audit-requested)' records/work-items/items
```

Open the relevant Status History and Implementation Ledger, not only the status
field. Use:

- `docs/index.md` for authority routing and main flows;
- `docs/glossary/*.md` for term authority;
- active design documents for forward contracts;
- envisioning documents for non-authoritative intent;
- deprecated documents only for prior rationale;
- owning module docs and live UI/API code for current behavior.

## 3. Classify the evidence

Verdicts may stack:

| State | Meaning |
| --- | --- |
| `already_built` | Runnable or shaped enough that most of the request exists |
| `on_map` | Open work or design directly covers it |
| `overlap` | Adjacent work should merge, split, or re-scope |
| `rejected_or_deprecated` | A durable record rejected or superseded it |
| `new_gap` | No direct coverage exists after the survey |
| `blocked` | A named dependency or authority decision blocks it |
| `deferred_by_design` | Intentionally outside the current cut |

Before proposing, answer:

- What outcome drives the request: stakeholder understanding, product surface,
  prototype, durable behavior, governance, or a staged split?
- What authority would the output carry?
- Which module or bounded context owns durable behavior, and which layer only
  renders or adapts it?
- Does it cross a safety, review, or release boundary?
- What maturity target does the repository define?

Use the repository's completion ladder when present. Otherwise state concrete
proof without inventing a generic maturity taxonomy. A named human assurance
gate remains `blocked` for the agent.

## 4. Envision before locking

Offer one or more concrete but non-binding shapes:

```text
Authority
<existing model, output, document, work item, or API>

Projection or user surface
<screen/report/workflow> -> <user action> -> <trace or review path>
```

For each, state what users see, what existing outputs it reuses, what is only a
fixture or prototype, what durable work would remain, and why the shape helps or
misleads.

If the user changes a first-class noun or boundary, revisit ownership and the
glossary instead of stapling the answer onto the old shape.

## 5. Decide

Invoke `grilling` only for unresolved scope choices. After answers, restate
**Locked Decisions** and **Still Open**; a first response is direction, not a
finished specification.

Before proposing new work, check canceled items, relevant ADRs, and deprecated
rationale so rejected shapes are not silently reopened.

When the accepted direction may need Campaign coordination, apply the threshold
in `docs/rules/governance.md`. Do not use a Campaign to make an unsettled
feature authoritative.

## Fit report

```markdown
**Verdict**
<stacked classifications with one-sentence conclusion>

**Evidence**
| Surface | What exists | Fit |
| --- | --- | --- |

**Interpretation**
<authority, domain ownership, and any material cross-cutting impact>

**Options**
| Option | Outcome | Pros | Trade-offs | Best when |
| --- | --- | --- | --- | --- |

**Must lock now**
- <decision>

**Can defer**
- <decision>

**Open questions**
- <risk or question, or None>
```

## Durable deliverable

After discussion converges, produce exactly one **Campaign seed**,
**implementation spec**, or **canceled feature memo**. Open
`references/deliverables.md` only at that point.

## Pitfalls

- Collapsing broad intent into its narrowest technical reading.
- Treating a narrative or prototype as durable domain authority.
- Hiding a model or policy change inside a feature spec.
- Reopening rejected work without new evidence.
- Implementing before the user accepts the spec and explicitly switches mode.
