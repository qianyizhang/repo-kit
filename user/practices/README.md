# Practice guides

These are reviewed personal defaults for relevant new work and changes. The
repository's explicit rules, supported runtime, contracts and required checks
retain authority. References inform a rule; their entire contents are not
implicitly adopted. An exception can be legitimate without weakening a contract.

| Changed surface | Read |
| --- | --- |
| TypeScript or React code, maintained frontend/tooling | [TypeScript and React](typescript.md) |
| Python libraries, tools or embedded runtimes | [Python](python.md) |
| Swift, SwiftUI/AppKit, Apple app lifecycle | [Apple native](apple-native.md) |
| User-visible flows, content, layout or interaction | [UI and UX](ui-ux.md) |

Read multiple guides only when the work crosses those surfaces. The working core
in [AGENTS.md](../AGENTS.md) owns shared verification, scope and communication.
Skills such as `finish-work` own their workflows; these pages supply focused
judgment, not another orchestration system.

Apply an applicable default within the requested change. A guide does not by
itself authorize a framework migration, new dependency, broad legacy rewrite or
change to a product's behavior. Surface a material conflict and use the local
owner to resolve it. Keep exact lint flags, check commands, product vocabulary,
visual identity and evidence-retention rules in that repository.

To extend these surfaces, edit `user/practices/` in repo-kit. Reconcile a new
lesson with existing guidance before adding it; record source and applicability,
and move mechanically enforceable rules into their existing tool owner where
appropriate. Repo-kit's `docs/user-instructions.md` owns intake, review and sync.
