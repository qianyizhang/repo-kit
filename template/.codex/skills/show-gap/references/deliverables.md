# Show Gap — final deliverable shapes

Reached from `SKILL.md` when a run converges. The draft report shape stays in the
skill body (every run produces one); these are the end-of-run branches.

## Implementation spec

Contents: feature goal, non-goals, evidence, locked decisions, target maturity,
affected files/modules, staged implementation plan, tests, doc/glossary/backlog
updates, acceptance criteria, and deferred work.

For speculative or early features the spec may be intentionally thin on file
edits and rich on goal/non-goal, screen concept, data flow, and open questions.
Do not pad it with fake certainty.

When the spec lands as a repo doc (usually `docs/design/`), its frontmatter
carries `produced_by: show-gap@<version> · agent=<model-id> · effort=<level> ·
<date>` per the signed-output rule. Conversation-only reports need no stamp.

## Canceled feature memo

Contents: original intent, evidence, why canceled or superseded, and what would
make it worth revisiting. Track it as a durable `canceled` item under
`docs/todo/items/`, with the revisit trigger in Context and Trade-offs. Same
`produced_by` rule when it lands as a repo doc.

## Spec → build handoff

Only when the user accepts the spec and explicitly says proceed. The discovery
contract travels with you — don't drop discipline because you're now coding:

1. **Name the primary backlog item first**; transition it to `wip` and append its
   Status History before implementation.
2. **Branch first** if on a shared/default or unrelated branch.
3. **Pick the smallest independently-verifiable slice** (the spec's stage 0 —
   models + one contract/safety rule + tests, not the whole feature). Land value
   that compiles and tests green, not a broad half-built sweep.
4. **Land the SSOT docs alongside the code**, in the same change: glossary terms,
   module README, `docs/index.md` row, backlog entry, import contracts. A new
   bounded context or domain noun updates the glossary in the same commit.
5. **Verify before claiming done**: `make lint` + `make test` green; if a
   pre-existing failure is unrelated, prove it (stash your change, re-run) and say
   so rather than letting it read as your regression.
6. **Checkpoint in the item**: append material decisions/deviations/verification
   to its Implementation Ledger and set the honest terminal or handoff status.
