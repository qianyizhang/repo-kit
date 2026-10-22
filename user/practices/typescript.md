# TypeScript / React

- Validate external data at its boundary; assertions are not runtime validation.
  Reuse canonical schemas and connect each operation's input and output types.
- Use discriminated unions for distinct cases. Add brands/wrappers only for real
  domain distinctions. Check ranges and indexes at runtime where types cannot;
  `readonly` does not freeze the underlying value.
- Keep React state minimal and owned once; derive render-time values. Use Effects
  for external synchronization, with cleanup and stale-response protection.
- Make cancellation and retry semantics explicit. Retry uncertain external effects
  only under an idempotency/delivery contract. Preserve failures with context.
- Keep cohesive behavior behind small interfaces and CLI/transport adapters thin.
  Respect existing runtime, module, compiler and lint choices.
- Test malformed inputs, state transitions and recovery. Use independent protocol
  contracts where permissive mocks could hide integration defects. For visible
  changes, read [UI/UX](ui-ux.md).

References: [TypeScript](https://www.typescriptlang.org/tsconfig/strict.html),
[indexed access](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html),
[React state](https://react.dev/learn/thinking-in-react).
