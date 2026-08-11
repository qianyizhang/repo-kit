---
description: Portable doctrine for profile-scoped technical authoring checks without automatic rewriting.
scope: authoring rules
status: experimental
last_update: 2026-08-11
document_class: coordination
---

# Authoring rules

Technical prose is an interface. Repositories may constrain avoidable wording
variation when that improves comprehension, review, translation, search, or
machine validation. This doctrine is not an ASD-STE100 compliance profile.

## doctrine vs profile

- This file owns the portable separation between structural validation,
  authoring findings, and human judgment.
- `[tool.authoring_check]` in the consumer repository owns languages, glossary
  sources, selected files and sections, and enforcement state.
- Domain vocabulary remains authoritative in `docs/glossary/`; the checker is a
  projection and never a second term store.

## rule families

Profiles can check canonical terminology, controlled modality, explicit actors,
one action or assertion per sentence, and conditions placed before dependent
actions. Only canonical-term replacement can be deterministic in the general
case; the structural prose rules are review signals unless a consumer proves a
stricter local contract.

## safety contract

- The checker reports findings and never edits source text.
- A replacement is suggested only when one avoided form maps to exactly one
  canonical glossary term.
- Ambiguous terminology has no replacement.
- LLMs are not part of the blocking check.
- Reports, faithful source material, generated artifacts, and deprecated text
  are excluded unless a consumer explicitly opts them in.
- Advisory findings return success. A repository can promote individual stable
  rule IDs through `blocking_rule_ids`; promotion is evidence-based, not global.

## checker boundary

`scripts/check_docs.py` continues to own deterministic document structure.
`scripts/check_authoring.py` owns profile-scoped prose findings. Keeping these
commands separate preserves trust in the structural gate while an authoring
profile is calibrated.
