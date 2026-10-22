---
description: Make AGENTS.md canonical and version personal defaults separately from repository governance.
scope: repo-kit instruction ownership and delivery
status: stable
last_update: 2026-10-22
document_class: coordination
---

# ADR-0007 — Maintain personal instructions at user scope

User decision, 2026-10-22: absorb the current user-level `AGENTS.md` into repo-kit,
include general working principles, and install it locally through an explicit
guarded sync. The subsequent closeout decision makes `AGENTS.md` canonical in
repo-kit and its template, with Claude entry points reduced to navigation.

## Decision

`user/AGENTS.md` owns the personal core and routes directly to on-demand guides.
`user/practices/` owns language, UI and host-specific guides. Python guidance
belongs there, outside Copier. Repo-specific contracts and exceptions stay local.
A standalone installer copies the reviewed bundle into the selected Codex home.
It supports read-only check and diff, reviewed
adoption of an existing file, local-edit refusal, recovery copies and retry after
an interrupted update. [User instruction maintenance](../user-instructions.md)
owns the commands and recovery procedure.

Repository instructions keep project identity, authority, invariants and checks.
The personal bundle is installed separately from Copier and shared skills.
Root `AGENTS.md` owns repo-kit's local constitution. The template seeds the
consumer-owned binding as `AGENTS.md`; `CLAUDE.md` only points to it. Existing
consumers require explicit binding reconciliation before updating; there is no
runtime fallback to the former authority. The migration handoff owns that process.

The local user installation already uses the bundle receipt. Retired single-file
receipt support is removed; backups retain the original instruction bytes.

Pstack contributes selected, reviewed concepts; its full orchestration is not
adopted. The existing six Matt skill snapshots stay unchanged. Dated research lives
in [the source review](../reviews/2026-10-22-practice-library.md), separate from the
maintained defaults. iOS guidance is prospective; local Apple evidence is macOS.

## Reason and consequence

Versioning one source makes personal instructions reviewable without copying them
into every repository. Explicit sync keeps changes to all personal projects
deliberate. This source contains personal macOS guidance; it is not a mandatory
default for other users of repo-kit. Local installation state is generated and
stays outside the source repository. There is no automatic reverse sync or updater.
