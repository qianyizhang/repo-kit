---
description: Python style doctrine — semantic types, closed value sets, and useful comments.
scope: python style rules
status: stable
last_update: 2026-10-22
document_class: coordination
---

# Python rules

Portable doctrine. Repo-specific exemplars (which files demonstrate a sanctioned
pattern) live in the repo's `AGENTS.md` binding, not here.

## baseline

- Python syntax and dependencies follow the repository's supported runtime; PEP 8.
- Lint/format via ruff. Shared doctrine defaults live in `ruff_base.toml`
  (extended by `pyproject.toml [tool.ruff]`); repo-specific `ignore` entries
  stay in `pyproject.toml` with a comment saying why.

## semantic typehints

Pick the container that *says what the data is for*:

- An existing schema/model system for runtime-validated serialized contracts.
- `dataclass`: the default record type.
- `NamedTuple` over bare `tuple`.
- `TypedDict` for fixed-key dictionary records; `dict[K, V]` for genuine mappings.
  `Mapping[K, V]` exposes a read-only API, not an immutable object or nested values.
- `object` for unparsed values; narrow before use. `Any` bypasses static checking;
  keep it at actual dynamic boundaries and explain where typed behavior resumes.
- `TypeAlias` for repeated complex patterns (e.g. sum types).

### closed value sets

Default to `Literal` — the value *is* the wire string: no drift, composes in
unions, no import needed to compare. Promote to `StrEnum` **only** when the type
carries behaviour or order that would otherwise be stranded in a side table:

- a state machine (a status type owning its allowed transitions),
- an ordinal scale (a severity type owning `.rank`),
- behaviour dispatch (an operator type owning `.apply`),
- member iteration.

Never promote a discriminator tag (`kind: Literal["criteria"]`). Explain a
non-obvious promotion beside the type, using the applicable justification.

## comments

Use names and structure for obvious behavior. Keep comments that explain
non-obvious rationale, invariants, constraints, or test intent beside the code
they protect. API docstrings describe usage, obligations, and failure semantics
that signatures cannot express. Update or remove comments with their code;
delete narration and spent TODOs after resolving their tracked work.

These tags are optional aids, not a required annotation scheme:

- `# WHY:` — non-obvious rationale for a design choice.
- `# INVARIANT:` — a property the surrounding code relies on staying true.
- `# CONTRACT:` — an obligation to/from another module or layer.
- `# COMPAT:` — a compatibility constraint (and when it can be dropped).
- `# TODO:` / `# HACK:` — tracked deferral or known shortcut.
- `# SAMPLE:` — for non-obvious data/rule shapes, a sample demonstrating the
  shape. Add regex examples when the accepted or rejected shape is non-obvious.
