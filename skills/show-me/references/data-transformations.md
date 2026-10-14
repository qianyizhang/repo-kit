# Data transformations: show the states

Show actual data movement and meaning changes, not only pipeline names.

1. Select one bounded, representative source record. Add a boundary case only
   when it materially changes the flow; de-identify sensitive values.
2. Show the intermediate representations in order. Identify fields preserved,
   derived, changed, split, dropped, or unresolved at each stage.
3. Use the repository's glossary and contracts for transformation terminology.
   Distinguish representation changes, identity/meaning decisions, and writes.
   When a stage maps to a controlled authority, name it and expose unmatched,
   ambiguous, or conflicting outcomes rather than implying universal success.
4. Label where values live: source, transient memory, decision record, lineage,
   or output, using only the layers that actually exist. Show whether the stage
   mutates existing data or produces a separate artifact.
5. End with what the consumer sees and what is stored. Clarify unchanged source
   data when a status or metadata link could be mistaken for a source rewrite.

Prefer a compact `before → stage → after` view; add a field table when helpful.
The agent selects representative evidence and judges the explanation; code,
contracts, and observed artifacts establish behavior. Mark proposed states and
unverified transitions explicitly. A visual does not prove runtime behavior.

Adapted from `western_order-workbench/.agents/skills/show-me/SKILL.md` at
commit `5a78794456dfe24bc7bec27f13d855a60ed409c7` (2026-09-01). The portable
procedure preserves state tracing; repository-specific curation definitions
remain with their owning authorities.
