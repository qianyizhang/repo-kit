# Apple native

- **Compatibility** · Check toolchain, Swift language mode and deployment target independently.
- **Platform fit** · Share domain contracts. Adapt controls, input and lifecycle to each platform. Reuse production views and local design tokens in previews. [UI/UX](ui-ux.md)
- **Lifetimes** · Explicit actor isolation, task and resource ownership, and an appropriate executor for blocking work. Cancel superseded work and reject stale results.
- **State** · Distinct drafts and commits. Preserve drafts through dismissal, navigation, activation and recovery. For forms that own async task lifetimes and recovery handoffs, use a dedicated `@MainActor` `ObservableObject` editor with draft-ID staleness guards while keeping persistence and transactions on the session or model owner.
- **Native acceptance** · Exercise focus, keyboard and state journeys. Installed upgrades, signing, keychain migration and live sign-in/inference require direct evidence. On capture failure, inspect the first error, retry only after a relevant change, and report the blocked visual checks while continuing independent work.
- **iOS acceptance** · On the actual device/OS target, verify scenes and background transitions, permissions, safe areas, keyboard, rotation and text scaling.

[Swift API design](https://www.swift.org/documentation/api-design-guidelines/) · [Concurrency](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/) · [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/) · [Testing](https://developer.apple.com/documentation/xcode/testing)
