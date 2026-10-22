# Outcome and wiring matrix

The browser harness loads the delivered HTML into an opaque-origin iframe with
restrictive CSP. Its official SDK `AppBridge` forwards tools/resources through
`tests/host-server.ts` to the actual bundled stdio server. Context, conversation
and teardown decisions are controlled by that test host. They are actual SDK
requests/responses, but not native Codex conversation acceptance.

| Outcome                                | Exercised wiring                                                                           | Required evidence / assertion                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixture success / errors / uncertainty | `makeFixture` → observation projection → graph/log                                         | No host POST or operation; explicit fixture provenance.                                                                                                                    |
| Tool success                           | UI → `callServerTool` → SDK host → real `example_echo` → response                          | Same run on both transports; four sequence events; exact payload inspection; bounded report.                                                                               |
| Tool failure                           | Same route with `fail: true`                                                               | JSON-RPC result with `isError: true`, failure outcome.                                                                                                                     |
| Resource success                       | UI → `readServerResource` → real resource template                                         | JSON resource and run ID through both connections.                                                                                                                         |
| Resource missing                       | Same route with the missing URI                                                            | Protocol error, distinct from tool result failure.                                                                                                                         |
| Context acknowledgment                 | UI → `updateModelContext` → SDK host handler                                               | No server domain operation or claimed model turn.                                                                                                                          |
| Message acknowledged                   | UI → `sendMessage` → SDK host accept                                                       | Acknowledgment, unobserved conversation route; no model-delivery claim.                                                                                                    |
| Message rejected                       | Same SDK request → host rejection                                                          | Error outcome, no successful conversation route.                                                                                                                           |
| Message timeout                        | Same SDK request → host delays past timeout                                                | Uncertain; no auto resend; conversation check required; new send requires explicit confirmation.                                                                           |
| Unsupported capability                 | Host advertises no message/context capability                                              | Action disabled; no request fabricated.                                                                                                                                    |
| Missing server trace                   | Host rejects `example_trace`, real echo still succeeds                                     | Success and missing evidence coexist; refresh does not repeat echo.                                                                                                        |
| Build mismatch                         | Host exposes stable identity from an older server                                          | Live blocked before version-specific parsing; fixture remains usable.                                                                                                      |
| Incremental tool input                 | Host sends real SDK partial notifications then final input                                 | Stable graph row updates; pin displays latest snapshot; raw partial/final events remain logged.                                                                            |
| Composite journey                      | Four intentional UI steps through real resource/tool and SDK context/message               | One correlated run, 12 boundary events; no automatic message send; phase focus.                                                                                            |
| Teardown during pending operation      | Delayed real tool request + SDK teardown                                                   | Abort lifetime, preserve closed connection and uncertain pending action; no stale callback overwrite.                                                                      |
| Export and closure                     | Browser download or advertised host download → explicit receipt/skip choice → SDK teardown | Export request distinguished from file receipt; cleanup acknowledgment; reopen creates fresh lifetime.                                                                     |
| Repeated snapshots / restart           | Observation store with overlapping snapshots and a changed source instance                 | No duplicates; bounded eviction; connection-scoped identity; late data preserves raw receipt order; only a unique complete RPC path may use labelled inferred graph order. |
| Narrow / keyboard / dark               | Delivered app, 390 px viewport, keyboard and host theme change                             | No document overflow; payload focus/Escape; dark rendering; no fixture calls.                                                                                              |

## Commands

```sh
npm run check
EXAMPLE_TEST_PORT=4397 npm run test:browser
EXAMPLE_CODEX_BIN=/absolute/path/to/desktop-bundled/codex npm run probe:codex
```

The port override isolates tests from other previews; it does not reuse an existing
server. `check` includes an isolated package-level server test with no source
imports. `observability.test.ts` covers store/projection invariants; browser tests
cover the rendered wiring and failure paths above.

The native probe requires the installed fingerprint to match `dist/build.json`.
A stale installed build is a failed acceptance precondition, never a pass for this
checkout. The probe proves native app-server tool/resource transport, not desktop
iframe interaction. Real message arrival in the owning conversation and host panel
removal still require the installed, connected native UI.

## Verification for 0.3.0

- Build `e0dbe92d7284`: formatting, typed lint, TypeScript and bundling passed.
- 11 protocol/unit tests and 10 browser wiring tests passed.
- Root repository checks: 86 tests ran, 83 passed, three optional Copier checks skipped.
- Manual SDK-host review confirmed a uniquely labelled real echo response, its
  server instance, correlated run ID and captured response payload.
- Native probe reached the installed plugin but rejected its older build
  `a5697f54542b`. Installed desktop acceptance is pending installation/reconnection
  of the tested build; actual conversation arrival and panel removal are not
  claimed.
