# Python

- **Runtime** · Follow the supported interpreter, including embedded runtimes. Lint settings live in config.
- **Models** · Reuse the owner of validation. Use dataclasses for internal records, `TypedDict` for fixed-key wire data and dict/`Mapping` for collections. `Mapping` and frozen dataclasses can contain mutable values. Assign mutation ownership explicitly.
- **Boundaries** · Accept unparsed values as `object`, validate once, then narrow. Limit `Any` to dynamic boundaries. Preserve wire fields, null/absence, units and raw evidence.
- **Choices** · `Literal` for wire choices. Enums for shared behavior or iteration.
- **Effects** · Functions own transforms. CLI parsing stays at the edge. Make I/O and state changes explicit. Imports stay inert and require no private data.
- **Failures** · Catch expected errors where they can be handled and preserve their causes.
- **Comments** · Explain non-obvious constraints and rationale. Docstrings capture obligations beyond the signature. Remove narration and resolved TODOs.

[Typing](https://typing.python.org/en/latest/spec/concepts.html) · [Mapping](https://peps.python.org/pep-3119/#mappings) · [PEP 8](https://peps.python.org/pep-0008/)
