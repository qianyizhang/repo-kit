---
description: Portable terms for decisions, coordination and evidence in agent work.
scope: agent-collaboration glossary
status: stable
last_update: 2026-10-23
document_class: coordination
---

# Agentic glossary

These terms name recurring distinctions in agent work. Procedures belong to
[governance](governance.md), [document lifecycle](doc.md), and the invoked skill.
Repositories own domain vocabulary, mode names and completion levels.

## Control loop

| Term | Meaning |
| --- | --- |
| **Lock** / **numbered lock** | An accepted decision, optionally numbered. It does not authorize a separate action. |
| **Grill** | An evidence-based interview that resolves material choices before implementation. |
| **Slice** | One unit of work that can be reviewed and verified independently. |
| **Checkpoint** | A partial result identifying completed work, remaining work and the resumption point. |
| **Decision memo** | Evidence, options, trade-offs, recommendation and unresolved choices for one decision. |
| **Intent restatement** | A short interpretation of an ambiguous request, exposed before acting. |

## Coordination

| Term | Meaning |
| --- | --- |
| **Handoff** | A durable transfer sufficient to continue without the previous chat's memory. |
| **Packet** | The bounded context exported for a handoff or ownership claim. |
| **Implementation ledger** | Append-only material findings, decisions, deviations and verification in a work record. |
| **Claim ledger** | A mutable table of current surface ownership and release rules; separate from implementation history. |
| **Integrator** | The designated owner who combines parallel writers' results. |
| **Single-writer** | One owner per claimed surface at a time. |
| **Field-notes** | A demonstrated reusable workflow defect or unresolved issue, recorded in its existing owner. |

## Epistemic honesty

| Term | Meaning |
| --- | --- |
| **Mode** | A task's declared purpose and allowed actions; projects define any named modes. |
| **Done ladder** / **rung** | Repository-defined completion levels, distinguishing local verification, release and deployment. |
| **Faithful** | Source-preserving extraction; rewriting or synthesis must be labelled separately. |
| **Corpus-silent** | A claim absent from the cited source; it remains an attributed candidate, not source evidence. |
| **Full means full** | A coverage claim supported by actual enumeration or re-derivation; partial work remains partial. |

## Craft register

| Term | Meaning |
| --- | --- |
| **Seam** | A boundary where behavior can change or work can be divided. |
| **Spine** | The main route to owning material, without copying that material into each route. |
| **Shim** | A compatibility adapter justified by a real caller; retire it when that obligation ends. |
| **Scaffolding** | Temporary support for reaching a result, removed when no longer needed. |
| **Guardrail** | An enforceable constraint with a clear supported path. |
| **Barrier** | A point requiring all prerequisite work to finish before proceeding. |
| **Backstop** | A safety limit for runaway behavior, not a normal operating target. |
| **Primitive** | A reusable operation composed by other workflows. |
| **Load-bearing** | Something with dependents that must be checked before it changes. |
| **Fan-out** | Parallel work on independent items. |
| **Backfill** | Repair of a missing record, definition or coverage entry. |

## Pointers (owned elsewhere — do not redefine)

- [Skill glossary](skill-glossary.md): invocation, disclosure, pruning and frontier terms.
- [Governance](governance.md): scoped authority, Campaign threshold and symlink rules.
- [Core models](core-models.md): cross-decision relationships and deliberate changes.
- [Documentation](doc.md): record classes, required metadata and lifecycle.
- Repository glossary and contracts: domain terms, provenance and witness meanings.
