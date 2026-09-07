---
name: show-gap
version: "0.11.1"
description: >-
  Fit fuzzy feature intent to built, planned, rejected, and deferred repository
  evidence. The bounded read-only audit may be agent-invoked; discussion and
  durable specification require clear user intent.
scope: repo feature gap analysis skill
status: experimental
last_update: 2026-09-07
document_class: artifact
---

# Show Gap

Turn “I vaguely want X” into a repo-grounded fit and, when discussion converges,
a Campaign seed, implementation spec, or canceled memo. Code is not an output.

Use `next-slice` for “what next?”, stale planning, or readiness questions. This
skill owns fuzzy feature intent. For an explanation of known behavior, use
`show-me`; a request to understand a pipeline alone does not need a fit audit.

An agent may invoke the initial evidence audit to prevent speculative work. Stop
after the fit report unless the user asks to explore options, answer the grill,
or produce a durable deliverable.

## Boundaries

Ground the fit in live evidence and repository authorities. Check new nouns
against the glossary; route accepted cross-cutting changes to `domain-modeling`.
Implementation requires explicit user authority.

## 1. Capture intent

Restate the desired outcome in one concrete sentence and list likely aliases
without sharpening uncertainty prematurely.

## 2. Survey

Search the navigator, glossary, active plans, work histories, live code, and tests
using those aliases. Include rejected and superseded work before proposing a
new shape.

Read relevant work-item histories and ledgers, not just status fields. Follow
the navigator to owning authorities; use deprecated documents for rationale and
live code or observed behavior for implementation evidence.

## 3. Classify the evidence

Verdicts may stack:

| State | Meaning |
| --- | --- |
| `already_built` | Verified current behavior satisfies the requested outcome |
| `on_map` | Open work or design directly covers it |
| `overlap` | Partial or adjacent coverage; name the remaining behavior and fit |
| `rejected_or_deprecated` | A durable record rejected or superseded it |
| `new_gap` | No direct coverage exists after the survey |
| `blocked` | A named dependency or authority decision blocks it |
| `deferred_by_design` | Intentionally outside the current cut |

A design, scaffold, or prototype is evidence of shape, not proof of completed
behavior. State what was verified and what remains unverified.

State the intended outcome, its owner, and the authority the proposed output
would carry. Name any dependency, review, or release gate. Use repository-defined
completion criteria or concrete proof; leave human-owned gates for their owners.

## 4. Envision before locking

Show a concrete scenario or data flow: owning authority → proposed surface →
user action → outcome. State what it reuses, what is a prototype, and what
behavior remains to build. Label the shape as a proposal.

If the user changes a first-class noun or boundary, revisit ownership and the
glossary instead of stapling the answer onto the old shape.

## 5. Decide

Invoke `grilling` only for unresolved scope choices and follow its lock rule.
After answers, restate **Locked Decisions** and **Still Open**; distinguish
accepted scope from any remaining specification work.

When the accepted direction may need Campaign coordination, apply the threshold
in `docs/rules/governance.md`. Do not use a Campaign to make an unsettled
feature authoritative.

## Fit report

Lead with the fit verdict, supporting repository evidence, and the remaining
behavior or uncertainty. State ownership and a concrete shape when needed to
make the outcome clear; use `show-me` for the visual explanation.

Compare options only when there is a real choice. List decisions or deferrals
only when they exist. A short fit answer needs no fixed table or empty sections.
Stop here unless discussion or a durable deliverable is requested.

## Durable deliverable

After discussion converges, produce exactly one **Campaign seed**,
**implementation spec**, or **canceled feature memo**. Open
`references/deliverables.md` only at that point.
