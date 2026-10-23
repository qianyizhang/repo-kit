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
- Let the package manager generate dependency metadata. Never bulk-replace
  dependency versions, URLs or integrity hashes when bumping an application's
  version. Repair a malformed lockfile against published package metadata;
  lower a real dependency version only for a demonstrated compatibility reason.
- Before pushing npm projects, run `npm ci` against the exact committed candidate
  in a disposable checkout with an empty cache per package. Existing
  `node_modules` or cached tarballs can hide invalid URLs. An install failure
  blocks publication; correct the dependency source instead of adding a fallback.
  Run the same gate in CI, then the project's build and behavioral checks.
- Test malformed inputs, state transitions and recovery. Use independent protocol
  contracts where permissive mocks could hide integration defects. For visible
  changes, read [UI/UX](ui-ux.md).

References: [TypeScript](https://www.typescriptlang.org/tsconfig/strict.html),
[indexed access](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html),
[React state](https://react.dev/learn/thinking-in-react).
