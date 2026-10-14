---
description: Ownership and maintenance of repository-specific agent skills.
scope: skill authoring rules
status: stable
last_update: 2026-10-14
document_class: coordination
---

# Local skill rules

Shared generic skills come from a separate user-level installation. This
repository owns only its specialized skills, paths, invariants and verification.
Keep local skills under `.codex/skills/` and use the declared discovery links.

Use the installed `writing-for-agents` when changing agent guidance. Keep a
skill focused on non-obvious decisions and outcomes; reference existing owners
instead of duplicating their rules. Read conditional resources only when needed.

Validate names, descriptions, local links, invocation metadata and actual
behavior affected by a change. Repository-owned skills use the metadata expected
by this repository's documentation checks. Third-party skill text stays with its
upstream owner rather than acquiring a parallel local version.

Record reusable defects in their existing owner. Routine success needs no ledger,
artifact stamp or mandatory retrospective. Preserve project-specific evidence
and authorizations when changing a workflow.
