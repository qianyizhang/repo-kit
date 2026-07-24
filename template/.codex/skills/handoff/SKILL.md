---
name: handoff
version: "0.6.0"
description: >-
  Coordinate parallel agents or multi-session work with a claim ledger, stop
  conditions, and a single integrator merge; or write a lightweight session
  handoff for a fresh context window. Use when running agent 1/N builds,
  picking up mid-flight work, handing off to Claude/Codex/another session,
  cutting context near the smart zone, or when the user asks for a ledger /
  claim protocol.
scope: session and multi-agent coordination skill
status: experimental
last_update: 2026-07-20
document_class: artifact
---

# Handoff

Prevent silent overwrites, soft "full", and lost context when more than one
agent (or session) writes the tree — **or** when a single writer needs a
fresh context window. **Process skill** — no product code required.

## Modes

Pick one mode at the start; do not mix tables unless both apply.

| Mode | When | Artifact |
| --- | --- | --- |
| **`session`** | Single writer; tool switch; pause; approaching degraded context | Session handoff packet |
| **`parallel`** | Two or more writers may touch the tree | Claim ledger + worker ledgers + integrator merge |

Default: **`parallel`** only when multi-writer is explicit (`agent 1/N`, concurrent
`/goal`s, fan-out). Otherwise use **`session`**.

---

## Mode: `session` (lightweight context bridge)

Compact the conversation so a **fresh** agent session can continue. Do not open
a claim ledger unless parallel writers appear.

### When to use

- Switching Claude ↔ Codex ↔ another harness mid-flight.
- Long DECIDE/fit packaging approaching context pressure (smart zone).
- User asks for a handoff / pickup packet without parallel agents.
- IMPLEMENT should start from durable files, not chat memory.

### Packet (write the file first, then summarize in chat)

Default path:
`records/reports/session-handoff-<topic>-<YYYYMMDD>.md`

Use the OS temp directory only when the user does not want a tracked report.

```markdown
---
description: Session handoff for <topic>
scope: session handoff report
status: draft
last_update: YYYY-MM-DD
document_class: report
---

# Session handoff — <topic>

**Mode:** <epistemic mode>
**Authorized transitions:** e.g. `DECIDE → IMPLEMENT` or `none`
**Stop condition:** <checkable done>

## Authoritative paths
- Primary work item:
- Plan / spec / design:
- Other SSOTs:

## Done / left / open
- Done:
- Left:
- Open questions:

## Suggested skills
- …

## Forbidden actions
- …

## Notes
Reference artifacts by path; do not restate bodies already in those files.
```

Rules:

- Include **suggested skills** the next session should invoke.
- Do **not** duplicate content already in specs, ADRs, work items, commits, or
  diffs — path/URL only.
- Redact secrets and PII.
- If the user stated the next session's focus, tailor the packet to that focus.
- Stamp `produced_by: handoff@<version> · agent=<model> · <date>` in
  the report body or frontmatter when useful.

Session mode does **not** authorize parallel writes. If a second writer appears,
switch to **`parallel`** and claim surfaces before further edits.

---

## Mode: `parallel` (claim ledger)

### When to use

- User assigns `agent 1` / `agent 2` / parallel `/goal`s.
- Long extraction/doc campaigns that may hit rate limits mid-flight.
- Any fan-out where two writers might touch the same path.

### 1. Claim ledger (before parallel writes)

Create or update a single claim file (default:
`records/reports/claim-ledger-<topic>-<YYYYMMDD>.md`):

```markdown
# Claim ledger — <topic>
produced_by: handoff@0.6.0 · agent=<model> · <date>
stop_condition: <checkable done>

| Surface (path or pack id) | Owner (agent/session) | Status | Notes |
| --- | --- | --- | --- |
| `src/...` | agent-2 | claimed | |
| `docs/...` | agent-1 | done | path-verified |
```

Rules:

- **Claim token = ledger row.** Do not edit a surface you do not own.
- Claims cover direct and transitive writes. Before running a command, identify
  every tracked path it may generate or refresh; a test that invokes a
  materializer is a writer even when its test file is outside the claim.
- Claim commands/generators as surfaces when their write footprint crosses
  multiple paths. Do not run one while an active claim owns any path in that
  footprint.
- Shared roots (`docs/index.md`, the primary `records/work-items/items/` record, package
  `__init__`) are **integrator-only** unless explicitly claimed by one writer.
  `records/work-items/backlog.md` is normally unchanged because it is the lifecycle/schema
  navigator, not the per-run tracker.
- Status values: `claimed` | `wip` | `done` | `blocked` | `dropped`.
- **Full means full** on each claimed surface; `dropped` requires a reason, not
  a silent shrink of scope.

### 1b. Worker seeding — packet, never fork

Spawn each worker as a **fresh session seeded from a claim packet**: the claim
row, the work slice (worklist/blocks/records), the input corpus or its hashes,
the output contract/schema, and the validator entrypoint — everything the claim
needs and nothing else. Do **not** fork/clone the coordinating session into
workers: identical priors make parallel workers race shared namespaces (three
cross-fork slug collisions in one campaign), and the inherited history re-feeds
megatokens of context the packet replaces at ~76 KB — a full-history fork has
twice exhausted a weekly rate window in a single stage. On Codex `spawn_agent`
this is one parameter: **`fork_turns: "none"`** (`none` / `all` / `"<N>"`;
**defaults to `all`**, the full-history fork that caused both burns) with the
packet brief as the spawn message, which keeps the integrator's mailbox
(`wait_agent` / `send_message`) intact. A fully separate session is the fallback
if `none` proves too bare. Fork-cloning is reserved for handing off the
*integrator* role itself. A worker brief is four steps: read spec → read packet
→ work claim → finalize (write + hash + seal outputs). Shell workers source the
campaign env script first. A resumed/forked session trusts the latest durable
preflight snapshot instead of re-verifying, unless it is absent, stale, or HEAD
moved.

### 2. Per-agent run ledger

Each worker appends (same file or `records/reports/...-agent-N.md`):

- What was completed (paths).
- Deviations from the plan.
- Deferred / open questions.
- Verification run (`make check` / subset) and result.

Worker ledgers are recoverable execution material, not a parallel backlog. The
integrator distills material findings, decisions, assumptions, deviations,
verification, and handoff facts into the primary item's Implementation Ledger.

Write the output file **before** summarizing in chat so a cut session is
recoverable (`docs/rules/skill.md` subagent durability).

### 3. Pickup / handoff packet

When resuming or switching tools under parallel mode, the packet must answer:

1. Primary backlog-item path and authoritative plan/spec path(s).
2. Claim ledger path and which rows are free vs done.
3. Stop condition (checkable).
4. Forbidden actions (e.g. do not rewrite `sources/library/`).
5. Epistemic mode (`FAITHFUL`, `RESEARCH`, `SYNTHESIZE`, `AUDIT`, `DECIDE`,
   `IMPLEMENT`, or `OPERATE`) and any authorized transition sequence.

A pure context cut with one writer should use **`session`** mode instead of an
empty claim table.

### 3b. Worker-class scorecard (long campaigns)

When a campaign fans out repeatedly, keep one structured scorecard (default:
`<campaign-root>/delegation-quality.checkpoint.md`) instead of free-form notes.
One row per worker-class × stage:

| Worker class | Stage | Batches | Fan-in rejections (form / namespace / semantic / citation) | Sample audits | Trust tier |
| --- | --- | --- | --- | --- | --- |
| local Codex | 1 | 17 | 2 / 1 / 0 / 0 | pass | trusted-disjoint |

Trust tier ∈ `calibrating` (first claim is a small sample or eval packet,
integrator reviews everything) · `trusted-disjoint` (full batch size, sampled
audit) · `blocked-env` / `blocked` (no further claims; record why). **Batch size
and sampling rate are functions of the tier, not vibes** — promote or demote a
class only on scorecard evidence, and record environment denials (e.g. tenant
policy blocks, zero-content probes) as environment evidence, never as provider
quality.

### 4. Integrator merge (one agent only)

After workers finish:

1. Enforce the merge barrier: every worker wrote durable output, stopped, and
   released its claims. Do not start repository-wide tests or generators first.
2. Re-read all run ledgers.
3. Merge shared files once.
4. Append material worker findings/decisions/deviations to the primary backlog
   item's Implementation Ledger; append its Status History once, as integrator.
5. Path-verify samples; run `make check` only after the barrier.
6. Close claim rows. Update the primary Work Record and owning machine-readable build, assurance, release, or clinical-slice artifacts.
7. Field-notes: if the protocol hurt, refine this skill or create a backlog item.

## Anti-patterns

- Using a full claim ledger for a single-writer session cut (`session` is enough).
- Two agents editing the primary backlog item or `docs/index.md` without an
  integrator.
- Relabeling unfinished claims as `done` to close the ledger.
- Handoff by chat only ("see above") with no file.
- Mixing `FAITHFUL` raw curation with SYNTHESIZE redesign in the same claim.
- Letting a worker silently cross from `AUDIT` into fixes, from `RESEARCH` into
  policy, or from `OPERATE` into workflow redesign.
- Treating a command as read-only because its top-level name is `test`; inspect
  fixtures and transitive materialization first.

## Minimal claim-ledger template (parallel)

```markdown
---
description: Claim ledger for <topic>
scope: multi-agent coordination report
status: draft
last_update: YYYY-MM-DD
document_class: report
---

# Claim ledger — <topic>

**Stop condition:** …

**Mode:** parallel · AUDIT | DECIDE | IMPLEMENT | OPERATE | …

**Authorized transitions:** e.g. `AUDIT → IMPLEMENT → AUDIT`, or `none`

| Surface | Owner | Status | Notes |
| --- | --- | --- | --- |
| | | claimed | |
```
