# Python

Reviewed 2026-10-22. Use for Python libraries, applications and maintenance tools.
Use the owning runtime and tool configuration: an embedded Blender interpreter,
a standalone script and an application package can have different constraints.

## Values and boundaries

| Meaning | Suitable representation |
| --- | --- |
| Internal record or computed result | Dataclass, unless an existing model already owns it |
| Fixed-key dictionary payload | TypedDict, especially for an established wire shape |
| Genuine key-to-value collection | `dict[K, V]` or read-only `Mapping[K, V]` interface |
| Unparsed value | `object`, narrowed before use |
| Runtime-validated serialized contract | Existing schema/model system where validation is required |
| Stateful resource with lifetime or identity | Ordinary class |

This is a choice by meaning, not a requirement to replace every dictionary or add
Pydantic. Preserve established wire fields, null/absence distinctions, extension
data, hashes and historical acceptance when refactoring.

- Normalize and validate input at its owning boundary, then pass typed values to
  operations. Keep raw evidence distinct from normalized values where provenance
  matters. Avoid repeated probes/defaults that conceal missing required data.
- `object` keeps static checks until narrowed; `Any` bypasses those checks. Use
  `Any` only at a real dynamic or library boundary, with a clear reason and a
  bounded place where typed behavior resumes.
- `Mapping` exposes a read-only API; it does not freeze the underlying mapping or
  nested members. Frozen dataclasses also do not make nested lists immutable.
  Make mutation ownership or immutable representation explicit when it matters.
- Type annotations and dataclasses do not enforce runtime field validity. Keep
  domain and scientific invariants in their owning validation/computation.
- Use named fields and closed choices when they express the domain. Keep codes,
  units and discriminators owned once; a type refactor is not permission to
  redefine a persisted schema or introduce coercion.

## Functions and effects

Prefer focused functions for transformation and orchestration. Keep parsing CLI
arguments at the CLI and make I/O, subprocesses, publication and mutable state
explicit. Introduce abstractions to own a demonstrated seam, not to satisfy a
universal architecture recipe.

Catch expected failures at meaningful boundaries, retain their causes and add
context. Imports should not start work or require private local data. Keep
computation directly testable without duplicating production logic in the test.

## Verification and tools

Use the existing formatter, linter, type checker and applicable behavioral gates.
Select syntax and dependencies for the supported interpreter, including embedded
runtimes. Put exact settings in their config owners; explain only the rationale
and exceptions in prose. A style guide alone does not justify a new manifest,
runner, dependency or a compatibility-breaking migration.

## References

- [Python typing concepts](https://typing.python.org/en/latest/spec/concepts.html)
  and [runtime scope](https://typing.python.org/en/latest/spec/type-system.html).
- [Mapping API](https://peps.python.org/pep-3119/#mappings): read-only access is
  distinct from deep immutability.
- [PEP 8](https://peps.python.org/pep-0008/): project consistency and compatibility
  can outweigh a generic convention.
- [PyPA project configuration](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)
  and [Ruff configuration](https://docs.astral.sh/ruff/configuration/): consult the
  existing package/tool owner rather than copying a universal configuration.
