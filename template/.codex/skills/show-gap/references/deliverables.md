# Show Gap — durable deliverables

Open this reference only after the fit discussion converges.

## Campaign seed

Use a Campaign only when the threshold in `docs/rules/governance.md` is met.
Create or update `records/campaigns/<slug>.md` using the record shape in
`docs/rules/doc.md`. Seed current understanding and uncertainty; link precise
work items and durable decisions instead of copying them.

## Implementation spec

Include the feature goal, non-goals, evidence, locked decisions, target maturity,
affected authorities and modules, staged implementation plan, tests,
documentation/glossary/work-item updates, acceptance criteria, and deferred
work. Include core-model impact only when the feature materially changes a
cross-cutting relationship.

An early feature may be intentionally thin on file edits and rich on goal,
screen concept, data flow, and open questions. Do not pad it with fake certainty.

When the spec becomes a repository document, stamp it:

`produced_by: show-gap@<version> · agent=<model-id> · effort=<level> · <date>`

Conversation-only reports need no stamp.

## Canceled feature memo

Record the original intent, evidence, why it was canceled or superseded, and the
trigger that would justify revisiting it. Store a durable canceled item under
`records/work-items/items/` using the same `produced_by` rule.

## After acceptance

Implementation begins only after explicit user authorization. Use `next-slice`
when the first independently verifiable slice is not already settled, and
`handoff` only when another session needs a durable packet. Verification comes
from repository authority, not this portable skill.
