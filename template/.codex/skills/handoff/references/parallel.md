# Parallel writers

### 1. Claim ledger

Create one ledger before parallel writes. Default path:
`records/reports/claim-ledger-<topic>-<YYYYMMDD>.md`.

```markdown
---
description: Claim ledger for <topic>
scope: multi-agent coordination report
status: experimental
last_update: YYYY-MM-DD
document_class: coordination
produced_by: handoff@<version> · agent=<model> · effort=<level> · <date>
---

# Claim ledger — <topic>

**Stop condition:** <checkable done>
**Mode:** parallel · AUDIT | DECIDE | IMPLEMENT | OPERATE | …
**Authorized transitions:** <sequence or none>

| Surface | Owner | Status | Notes |
| --- | --- | --- | --- |
| `src/...` | agent-2 | claimed | |
| `docs/...` | agent-1 | done | path-verified |
```

Rules:

- A ledger row is the claim token. Do not edit an unowned surface.
- Claim direct and transitive writes, including generated files and tests that
  materialize artifacts.
- Claim a command or generator when its write footprint crosses several paths.
- Shared authorities are integrator-owned unless one writer explicitly claims
  them.
- Status is `claimed`, `wip`, `done`, `blocked`, or `dropped`. A dropped claim
  records why.

### 2. Seed workers

Give each worker only the claim, authoritative spec, inputs or hashes, output
contract, validator, forbidden actions, and stop condition. Prefer a fresh
context; on Codex use `fork_turns: "none"` when the packet is sufficient.

The brief is: read authorities -> work only the claim -> verify -> write durable
output and release the claim. A resumed worker may trust a current durable
preflight snapshot; recheck when it is absent, stale, or HEAD moved.

### 3. Worker output

Each worker records:

- completed paths;
- deviations and open questions;
- verification command and result;
- final claim status.

Write durable output before the chat summary. Worker notes are execution
material, not a parallel backlog; the integrator promotes material facts into
the primary work item.

### 4. Pickup packet

For a parallel-session switch, read [session handoff](session.md) and add:

- claim-ledger path;
- rows still claimed, free, done, or blocked;
- integrator identity.

A single-writer context cut uses `session`, not an empty claim table.

### 5. Integrate

After workers finish:

1. Enforce the barrier: every worker wrote durable output, stopped, and released
   or marked its claim.
2. Read all worker outputs.
3. Merge shared files once.
4. Append material findings, decisions, deviations, and verification to the
   primary work item.
5. Run repository-wide generators and checks only after the barrier.
6. Close the ledger and update the owning machine-readable artifacts. Apply
   `docs/rules/doc.md` closeout to released claim ledgers and worker notes;
   retain them only while a coordination or evidence dependency remains.
