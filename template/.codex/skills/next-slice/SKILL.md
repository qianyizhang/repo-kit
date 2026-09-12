---
name: next-slice
version: "1.5.0"
description: >-
  Verify live repository state, briefly rank backlog items, and recommend one
  independently testable next slice. Use when asked what to build next or to
  reassess planning readiness and priority.
scope: repository next-slice recommendation
status: stable
last_update: 2026-09-12
document_class: artifact
---

# Next slice

Choose one repo-grounded next move. Use `show-gap` for feature fit and `show-me`
for explaining existing behavior.

## Ground and rank

1. Inspect current repository state and the authorities relevant to the requested
   planning scope. Use the navigator to locate owners and any relevant Campaign.
2. Verify serious candidates against implementation, tests, and acceptance evidence.
   Search related completed, canceled, rejected, or blocked work; read deeper
   histories when they explain a constraint or conflicting claim. Mark unverified
   facts explicitly.
3. Rank by current value, dependencies/readiness, and smallest independent
   proof within a clear authority boundary. Prefer the active Campaign frontier
   unless evidence favors another move; Campaigns do not override authority.
4. Flag landed-but-open work, changed scope, decisions, and human gates. Suggest
   close/split/defer where appropriate; code completion does not clear a release
   gate. Correct trackers only when cleanup is authorized and evidence complete.

The agent judges priority; repository checks establish implementation evidence.
Resolve repository facts locally. Use `grilling` only for material unresolved
choices, preserving decisions and authorization already given.

## Brief output

Lead with the recommended outcome and why now in one sentence.

When multiple backlog items are in scope, give a ranked overview:

| Rank | Item | Outcome | Readiness | Recommendation / why |
| --- | --- | --- | --- | --- |
| 1 | <linked ID/title> | <brief benefit> | <verified state> | Do next — <reason> |
| 2 | <linked ID/title> | <brief benefit> | <verified state> | Later — <reason> |
| — | <linked ID/title> | <brief benefit> | <blocker or drift> | Unblock/close/split — <reason> |

Use one short row per in-scope item, linked to its work record or evidence.
Rank actionable work numerically; use `—` for blocked or stale items. If the
backlog is large, group lower-priority items explicitly rather than silently
omitting them. For one candidate, skip the table.

Expand only the top slice in at most three short bullets:

- Scope and authority boundary.
- Smallest proof and exact verification command.
- Needed planning/doc updates; decisions, gates, or model impact only if material.

Keep comparisons in the table; omit empty fields and repeated summaries. If no
item is ready, name the prerequisite instead of claiming a ready slice.
Stop at the recommendation unless implementation is already authorized.
