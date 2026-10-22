# Python

- Follow the supported interpreter and existing tool configuration, including
  embedded runtimes. Keep lint settings in configuration, not prose.
- Use dataclasses for internal records, TypedDict for fixed-key wire dictionaries,
  and dict/Mapping for collections. Reuse an existing model when it owns validation.
- Accept unparsed values as `object` and narrow them. Restrict `Any` to genuine
  dynamic boundaries, then resume typed behavior.
- `Mapping` is a read-only interface, not deep immutability; frozen dataclasses
  can also contain mutable values. Make mutation ownership explicit.
- Validate input once at its boundary; annotations do not validate runtime data.
  Preserve wire fields, null/absence distinctions, units and raw evidence.
- Prefer `Literal` for wire choices; use enums when behavior or iteration earns them.
- Keep transformations in functions, CLI parsing at the edge and I/O/state changes
  explicit. Imports must not start work or require private data.
- Catch expected failures at meaningful boundaries and retain their causes.
- Comments explain non-obvious constraints and rationale; remove narration and
  resolved TODOs. Docstrings cover obligations signatures cannot express.

References: [typing](https://typing.python.org/en/latest/spec/concepts.html),
[Mapping](https://peps.python.org/pep-3119/#mappings),
[PEP 8](https://peps.python.org/pep-0008/).
