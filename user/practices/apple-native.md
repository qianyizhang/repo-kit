# Apple native

- Check toolchain, Swift language mode and deployment target separately.
- Share domain contracts; adapt controls, input and lifecycle to each platform.
  Reuse production views and locally owned design tokens in previews.
- Make actor isolation and task/resource lifetimes explicit. `async` does not make
  blocking work safe. Cancel superseded work and reject stale results.
- Separate drafts from committed state; preserve work across dismissal,
  navigation, activation and recovery. For visible changes, read [UI/UX](ui-ux.md).
- Exercise native focus, keyboard and state journeys. Offline tests cannot prove
  installed upgrades, signing, keychain migration or live sign-in/inference.
- For iOS, verify the actual device/OS target: scene/background transitions,
  permissions, safe areas, keyboard, rotation and text scaling. Mac tests do not
  establish mobile acceptance.

References: [Swift APIs](https://www.swift.org/documentation/api-design-guidelines/),
[concurrency](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/),
[Apple HIG](https://developer.apple.com/design/human-interface-guidelines/),
[testing](https://developer.apple.com/documentation/xcode/testing).
