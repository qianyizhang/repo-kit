# TypeScript / React

- **Boundaries** · Validate external data at entry with the canonical schema. Treat incoming messages as unknown until validated. Check sender authority, ranges and indexes at runtime where required.
- **Request and reply types** · Give each operation one contract owned by its feature. Derive it from the existing schema or operation registry when available. The operation name and request variant determine the payload and reply. Carry that relationship through callers, adapters and handlers so callers infer the result and the compiler checks what handlers return.
- **Events and streams** · Type the messages each side can send. Distinguish acknowledgements, progress and terminal outcomes when they have different meanings. Preserve disconnect, cancellation and retry behavior.
- **Models** · Discriminated unions for distinct cases. Brands/wrappers for real domain distinctions. Treat `readonly` as a type restriction and assign mutation ownership explicitly.
- **React state** · Own minimal state once. Derive values during render. Effects synchronize external systems with cleanup and stale-response protection.
- **External effects** · Define cancellation and retry rules. An uncertain effect needs an idempotency or known delivery contract before retry. Preserve failure context.
- **Structure** · Cohesive behavior behind small interfaces, thin CLI/transport adapters and existing runtime, module, compiler and lint settings.
- **Acceptance** · Verify malformed input, state transitions and recovery. For changed message contracts, check that a wrong operation, payload or handler reply fails type checking. Exercise the real boundary where permissive mocks could hide defects. [UI/UX](ui-ux.md)

## Installation integrity

| Situation | Required evidence |
| --- | --- |
| Any install | Repository's pinned manager and frozen lockfile, e.g. `npm ci`. |
| Dependency metadata edits | Package manager generates dependency versions, URLs and integrity, including during app version changes. Repair against published metadata. Downgrade only for demonstrated compatibility. |
| Dependency, lockfile, registry, install-script or toolchain change, release, explicit integrity work | Verify the committed candidate in a disposable checkout with an empty cache/store. Existing modules and tarballs can hide broken sources. |
| Other work, including docs and tests | Reuse install evidence while relevant inputs and environment match. Keep required install gates and run affected build and behavior checks. |
| Applicable install fails | Publication stays blocked until the cause is fixed. |

[Delivery verification](github.md#final-verification) · [TypeScript strict mode](https://www.typescriptlang.org/tsconfig/strict.html) · [Indexed access](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html) · [React state](https://react.dev/learn/thinking-in-react)
