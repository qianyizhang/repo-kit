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
- Use the repository's pinned package manager and frozen lockfile for installation
  (`npm ci` for npm). For dependency, lockfile, registry, install-script or toolchain
  changes, releases, or explicit dependency-integrity work, verify the committed
  candidate in a disposable checkout with an empty package cache/store: existing
  modules and cached tarballs can hide invalid URLs. Keep required repository and
  CI install gates. For other changes, reuse successful install evidence when those
  inputs and the relevant environment are unchanged; test/docs-only edits do not
  by themselves require another empty-cache install. An applicable install failure
  blocks publication; repair its cause instead of adding a fallback. Run the
  affected build/behavior checks under the
  [delivery verification plan](github.md#final-verification).
- Test malformed inputs, state transitions and recovery. Use independent protocol
  contracts where permissive mocks could hide integration defects. For visible
  changes, read [UI/UX](ui-ux.md).

References: [TypeScript](https://www.typescriptlang.org/tsconfig/strict.html),
[indexed access](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html),
[React state](https://react.dev/learn/thinking-in-react).
