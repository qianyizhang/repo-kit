# TypeScript and React

Reviewed 2026-10-22. Use for TypeScript/TSX code and frontend or tooling changes.
Respect the project's compiler, runtime, package manager and module system;
compiled JavaScript is a valid delivery format.

## Contracts and modules

- Treat external messages, persisted documents and network responses as untrusted
  values. Validate at the owning boundary with the existing schema system; carry
  the resulting types inward. A type assertion does not validate runtime data.
- Connect each operation's input and output types so callers cannot independently
  choose an arbitrary response type. Reuse the canonical schema or generated
  contract instead of maintaining a parallel frontend definition.
- Use discriminated variants when cases carry different data. Give ordinary
  key-to-value collections ordinary indexed types; invent wrappers or brands only
  when a real domain distinction earns them.
- Encode what the type system can prove, then check remaining invariants. A
  `number` can be negative; a nonempty array still needs a justified computed
  index. `readonly` restricts access through a type, not all mutation of the value.
- Keep cohesive behavior behind a small interface. Follow existing import and
  dependency boundaries; use package restructuring only when it removes a
  demonstrated coupling problem. Thin CLI/transport adapters can call ordinary
  typed functions without introducing a framework.

## State, effects and failures

- In React, store the minimum authoritative state and derive values that follow
  from it. Give shared state one owner. Use Effects for synchronization with
  external systems, not to maintain duplicate render-time calculations.
- Make asynchronous lifetime explicit: cancellation, cleanup, obsolete responses,
  error presentation and ownership after unmount/reconnect. Retrying an operation
  whose external effect is uncertain needs its own delivery/idempotency contract.
- Preserve the original failure with useful context at a meaningful boundary.
  Missing or invalid data should not silently become a successful empty result.
- Let the formatter and typed lint configuration enforce mechanical conventions.
  Prefer stronger checking for a justified gap, but assess compiler/configuration
  changes separately from a behavior-preserving refactor.

## Verify the changed boundary

Use the repo's typecheck and lint scopes, including affected scripts and tests.
Exercise malformed input, relevant state transitions and failure/recovery paths
through stable interfaces. Test host/protocol adapters against an independent
contract when a permissive mock could conceal an integration defect. For React
interaction and layout, also use the [UI/UX guide](ui-ux.md).

## References and applicability

- [TypeScript strict checking](https://www.typescriptlang.org/tsconfig/strict.html)
  and [indexed access](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html):
  compiler options are authoritative; upgrades can change their checking scope.
- [typescript-eslint configurations](https://typescript-eslint.io/users/configs/):
  typed linting is useful, but strict presets are opinionated and can change
  outside major releases. Keep an existing oxlint or other justified setup.
- [Thinking in React](https://react.dev/learn/thinking-in-react): state ownership
  and derived data; framework guidance applies to React surfaces.
- [Google TS guide](https://google.github.io/styleguide/tsguide.html): selective
  reference with Google-specific constraints, not an adopted universal style.
- [pstack TS principles](https://github.com/cursor/plugins/blob/d1453c11d1dde9714d4c313c97d3a68432265c7f/pstack/skills/typescript-best-practices/SKILL.md):
  Lauren Tan, MIT; selectively adapted concepts. Validate examples against actual
  compiler options. This does not adopt `poteto-mode` or its orchestration.
