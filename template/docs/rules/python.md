---
description: Python style doctrine — semantic typehints, closed value sets (Literal vs StrEnum), and the tagged-comment taxonomy.
scope: python style rules
status: stable
last_update: 2026-07-07
document_class: coordination
---

# Python rules

Portable doctrine. Repo-specific exemplars (which files demonstrate a sanctioned
pattern) live in the repo's `CLAUDE.md` binding, not here.

## baseline

- Modern Python 3.12+ features and practices; PEP 8.
- Lint/format via ruff. Shared doctrine defaults live in `ruff_base.toml`
  (extended by `pyproject.toml [tool.ruff]`); repo-specific `ignore` entries
  stay in `pyproject.toml` with a comment saying why.

## semantic typehints

Pick the container that *says what the data is for*:

- `BaseModel`: the model needs serialization or crosses a domain boundary.
- `dataclass`: the default record type.
- `NamedTuple` over bare `tuple`.
- `TypedDict` over bare `dict`; `Mapping` to imply immutability.
- `Any` / `object` only with caution — and a comment explaining why.
- `TypeAlias` for repeated complex patterns (e.g. sum types).

### closed value sets

Default to `Literal` — the value *is* the wire string: no drift, composes in
unions, no import needed to compare. Promote to `StrEnum` **only** when the type
carries behaviour or order that would otherwise be stranded in a side table:

- a state machine (a status type owning its allowed transitions),
- an ordinal scale (a severity type owning `.rank`),
- behaviour dispatch (an operator type owning `.apply`),
- member iteration.

Never promote a discriminator tag (`kind: Literal["criteria"]`). Every
promotion carries a `# WHY:` stating which of the four justifications applies.

## comments

Code should be explicit and self-explanatory; no narrating comments, no
extensive doc prose. The tagged comments that *are* required, each with a clear
and concise explanation:

- `# WHY:` — non-obvious rationale for a design choice.
- `# INVARIANT:` — a property the surrounding code relies on staying true.
- `# CONTRACT:` — an obligation to/from another module or layer.
- `# COMPAT:` — a compatibility constraint (and when it can be dropped).
- `# TODO:` / `# HACK:` — tracked deferral or known shortcut.
- `# SAMPLE:` — for non-obvious data/rule shapes, a sample demonstrating the
  shape. Regex patterns always get one.
