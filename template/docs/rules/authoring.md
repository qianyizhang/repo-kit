---
description: Portable doctrine for profile-scoped technical authoring checks without automatic rewriting.
scope: authoring rules
status: experimental
last_update: 2026-09-12
document_class: coordination
---

# Authoring rules

Technical prose is an interface and a common-language projection between the
domain, humans, and agents. Repositories may constrain avoidable wording
variation when that improves comprehension, review, translation, search, or
machine validation. This doctrine adopts the useful spirit of controlled
technical language; it is not an ASD-STE100 compliance profile and does not
impose an external dictionary on repository vocabulary.

## doctrine vs profile

- This file owns the portable separation between structural validation,
  authoring findings, and human judgment.
- `[tool.authoring_check]` in the consumer repository owns languages, glossary
  sources, selected files and sections, and enforcement state.
- Domain vocabulary remains authoritative in `docs/glossary/`; the checker is a
  projection and never a second term store.

## rule families

Profiles can check canonical terminology, controlled modality, explicit actors,
one main action or assertion per sentence, and conditions placed before
dependent actions. Prefer short noun phrases, active verbs, and vertical lists
when a sentence carries several relationships. Only canonical-term replacement
can be deterministic in the general case; the structural prose rules are review
signals unless a consumer proves a stricter local contract.

## safety contract

- The checker reports findings and never edits source text.
- A replacement is suggested only when one explicitly replaced form maps to exactly one
  canonical glossary term.
- Ambiguous terminology has no replacement.
- LLMs are not part of the blocking check.
- Reports, faithful source material, generated artifacts, and deprecated text
  are excluded unless a consumer explicitly opts them in.
- Advisory findings return success. A repository can promote individual stable
  rule IDs through `blocking_rule_ids`; promotion is evidence-based, not global.

## glossary replacement contract

`TERM001` reads an optional `Replaced terms` column alongside `Term`. List only
forms deliberately replaced by the row's canonical term. Separate forms with
commas, semicolons, slashes or `or`; use an empty cell or `—` for none. Matching
ignores case. A form shared by multiple canonical terms receives a finding
without a replacement; a form that is itself canonical is not flagged.

`_Avoid_` describes human misconceptions, and `Aliases` may identify accepted
alternate labels. Neither supplies machine replacements. For example, an
`_Avoid_` cell saying “the referee” under `Pydantic` does not make those terms
interchangeable. A glossary without `Replaced terms` supplies no replacement rules.

## checker boundary

`scripts/check_docs.py` continues to own deterministic document structure.
`scripts/check_authoring.py` owns profile-scoped prose findings. Keeping these
commands separate preserves trust in the structural gate while an authoring
profile is calibrated.

The pragmatic phrasing practices are adapted from
[AminBlg/SimpleEnglish@59bf670](https://github.com/AminBlg/SimpleEnglish/tree/59bf6702197a5aadc96d197ea17f290d8d50dcd3).
Repo-kit does not copy its dictionary profile or claim ASD-STE100 compliance.
