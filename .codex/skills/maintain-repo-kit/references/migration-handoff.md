# Consumer migration handoff

Maintainers only. Consumer propagation is a separately authorized operation;
this runbook prepares an attributable update and preserves consumer authority.

## Before the next release or update

1. Re-run `survey.py` and compare every consumer with its recorded `_commit`.
2. Reconcile instruction ownership before the update: merge the local policy from
   `CLAUDE.md` and any independent `AGENTS.md` rules into `AGENTS.md`. Replace
   `CLAUDE.md` with the template's discovery pointer and commit this reviewed local
   migration. The new template seeds `AGENTS.md` and manages the Claude pointer;
   it does not infer which old instructions to keep. After updating, reconcile
   authority/authoring targets in the consumer's configuration and navigation.
3. Reconcile the 2026-10-14 skill delivery change: shared skills come from the
   separate user installation. Preserve consumer-specific skills and edits before
   Copier retires old generic copies. Governance seeds remain consumer-owned.
4. Classify existing consumer edits as portable evidence, local binding, or
   obsolete before Copier can replace a formerly seeded core. Before Python
   guidance leaves the template, preserve local additions to `docs/rules/python.md`
   in their repo-owned rules and remove stale navigation links.
5. Reconcile the new coordination paths into consumer-owned configuration and
   navigation: allow advisory Campaigns under `records/campaigns/` and handoffs
   or claim ledgers under `records/reports/`; add local routes only when useful.
   Do not add a dedicated class, status machine, or required Campaign record.
6. Exercise copy and update from representative recorded baselines in temporary
   repositories, then run repo-kit and consumer checks.
7. Propose the checkpoint/tag and each consumer update separately. Propagation,
   tagging, and pushing remain approval-gated.

## Historical survey snapshot

The read-only survey on 2026-08-17 at repo-kit `9a0df0db00ce` used the
pre-refactor ownership map. It found no deltas in then-managed paths. The
seeded/local paths below become managed under the new contract and need semantic
classification before any update; other drift from current repo-kit is update
lag, not consumer authorship.

| Consumer | Recorded baseline | Dirty | Seeded/local review |
| --- | --- | --- | --- |
| `biomed-concepts` | `v0.10.3` | no | none |
| `chronical-management` | `v0.8.0` | no | `doc-hygiene-audit`, `domain-modeling`, `glossary-drill`, `handoff`, `show-gap` |
| `drug-discovery` | `v0.10.3-5-g9a0df0d` | yes | `next-slice` |
| `drug-safety` | `v0.9.0` | no | `doc-hygiene-audit`, `domain-modeling`, `handoff`, `show-gap` |
| `med-track` | `v0.9.0` | yes | none |

The dirty consumers block update work until separately reconciled. Re-run the
survey rather than treating this snapshot as current truth.
