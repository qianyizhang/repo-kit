# Apple native apps

Reviewed 2026-10-22. Local implementation evidence is SwiftUI/AppKit on macOS.
iOS guidance below is prospective and source-backed; it has not been validated
against a local shipping iOS target.

## Swift and app ownership

- Inspect the package/project's toolchain, Swift language mode and deployment
  target separately. A Swift 6 toolchain does not imply that every target uses
  Swift 6 language mode. Adopt migrations within that target's constraints.
- Design APIs for clarity at their use sites. Share domain policy and contracts
  across platforms while adapting presentation, input and lifecycle to each one.
  Prefer system controls where their behavior fits the task.
- Express isolation and ownership in the interface. Keep UI state on its owning
  actor; keep blocking or expensive work from monopolizing UI execution. `async`
  alone does not make blocking work safe or move it off the current actor.
- Tie tasks, observers and resources to an explicit lifetime. Cancellation and
  stale-result checks should prevent dismissed or superseded work from publishing
  obsolete state. Keep secrets and persistence behind their existing owners.
- Give editable drafts and committed state distinct meaning. Exercise dismissal,
  navigation, app activation and recovery without losing user work.
- Reuse production views and state for previews/fixtures where practical. Keep
  visual tokens generated from the local design owner rather than editing forks.
  Use the [UI/UX guide](ui-ux.md) for the affected visible states.

## Verification layers

| Evidence | What it establishes |
| --- | --- |
| Compiler, lint, logic/state tests | Checked source and exercised model behavior |
| Rendered production-view preview | The observed layout/content in that fixture |
| Native interaction | The actual window, focus, keyboard and state journey tested |
| Installed upgrade / live integration | Only the tested installation, permissions, signing or service path |

Use the existing native harness and required gates. Swift Testing can serve unit
coverage; XCTest supports UI automation. Preserve a justified Command-Line-Tools
workflow when it provides the required evidence. Offline tests cannot prove live
sign-in, inference, keychain migration or an installed upgrade. Report those
boundaries explicitly.

## Prospective iOS adaptation

Before an iOS implementation, identify supported devices/OS versions and the
actual project target. Review scene/background transitions, permissions,
persistence and cancellation in the mobile lifecycle. Exercise text scaling,
orientation/size changes, safe areas, keyboard/input and assistive technologies
on supported configurations. Revalidate macOS assumptions rather than presenting
a desktop test as mobile acceptance.

## References

- [Swift API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/):
  clarity in real use cases; apply documentation guidance where it explains an API.
- [Swift concurrency](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/):
  use the version and isolation model supported by the target.
- [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/):
  platform conventions and components, interpreted through the product's design.
- [Xcode testing](https://developer.apple.com/documentation/xcode/testing) and
  [accessibility testing](https://developer.apple.com/documentation/accessibility/performing-accessibility-testing-for-your-app):
  combine appropriate test layers and task/device/accessibility matrices.
