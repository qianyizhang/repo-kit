# Repository review rules

One shared workflow; project-specific authority stays in the project.
Reuse existing contracts, testing guides, and review rules before adding a file.
An `AGENTS.md` pointer should say when to read the owner, not repeat its contents.
The absence of a binding never blocks an ordinary closeout.

## Minimal binding

Add a short section to the existing review/testing guide. Use `docs/review.md`
only when no existing owner fits. Adapt the headings to the repository:

```markdown
## Before committing a completed slice

- Contracts: [existing behavior/architecture owners].
- Verification: [maintained commands and change-to-check guidance].
- Review traps: [only the relevant, non-obvious local lessons below].
- Evidence and cleanup: [source/generated/retention owners, when applicable].
- Open work: [existing backlog]; commit history owns completed changes.
```

Read only entries whose trigger matches the changed surface. Keep commands in
their executable owner or established testing guide; avoid a second cached list.

## Turn findings into prevention

| Finding | Smallest useful owner |
| --- | --- |
| Deterministic mechanical mistake | Existing linter, validator, hook, or CI gate; check its wiring first |
| Behavioral regression | Test at the stable boundary that can expose it |
| Domain invariant or source-authority rule | Existing contract, with a review pointer if needed |
| Repeated judgment mistake | Short review rule with trigger, counterexample, and source |
| Environment/startup failure | Existing harness/preflight or troubleshooting owner |
| Larger unfinished change | Existing issue/work item, not a second review backlog |
| Routine successful check | Commit/normal handoff; no lasting ledger entry |

Prefer an automated guard to a prose rule when the condition is mechanical.
Automation proposals still need proportional scope and local verification.

## Optional learning ledger

For recurring or costly surprises, keep a small **Review lessons** section in the
same owner. It is a curated set of active lessons, not an append-only diary.

Each entry should establish:

- **Trigger and rule:** when this applies and what the reviewer must inspect.
- **Failure/evidence:** what escaped, with a commit/test/record link; distinguish
  an observed failure from a suspected one.
- **Guard and remaining judgment:** what now catches it, and what still needs a
  person or agent to assess.
- **Lifecycle:** proposed, active, or superseded; revisit when that contract changes.

Example: when changing native credential restoration, check that a suspended
credential read leaves the UI responsive and cancellation cannot publish stale
account state. Link the regression test and authentication contract. Offline
success does not establish a successful live sign-in.

Update a lesson when evidence changes its meaning. Retire duplicated guidance
once the guard and authoritative contract carry it. Retain evidence only while a
current claim or explicit retention obligation needs it. Never create empty
ledgers across every repository.
