# Verification through real boundaries

Use the generated package scripts and the target repository's required checks.
The starter's tests are fixtures for adapting the product, not a blanket
certification. Keep a lockfile from the chosen package manager before delivery.

| Contract           | Minimum observable check                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Plain message      | Send exact `hi`; host gets that text; no evidence read or context update                                         |
| Attached selection | Freeze one selected item's revision; inspect exact bounded context; unrelated items absent                       |
| Draft ownership    | Delay acknowledgment, edit draft/context, acknowledge old send; newer revision survives                          |
| Duplicate send     | Repeat click while pending; host receives one message                                                            |
| Rejection          | Host returns `isError`; no success state or draft clearing                                                       |
| Uncertain delivery | Dispatch then timeout/disconnect; payload remains; no automatic retry                                            |
| Scoped reads       | Exact item/event and pagination bounds; invalid target/range fails                                               |
| Opening            | Model-visible result contains identity/status; dataset remains panel-only until requested                        |
| Inspector          | Actual request/result bytes match frozen event except declared masking/limits; viewing does not execute again    |
| Payload capture    | Default files contain no message/source payloads; live inspection works; explicit capture includes only the selected interaction, masks secrets and reports limits/failure |
| Retention          | Caps, rotation, stale-session pruning, live-session exclusion and symlink refusal                                |
| Logging failure    | User action continues; recording health reports failure and memory-only evidence                                 |
| Catalog            | Registered tools and documented schemas/visibility/effects agree; new tools fail coverage checks if undocumented |
| Standalone         | Domain operations work over HTTP with no host; conversation action unavailable and copy/export useful            |
| Lifecycle          | Teardown/switch blocks stale completions; closing panel makes no false host cancellation claim                   |
| Host               | Real SDK AppBridge, opaque iframe origin, restrictive CSP, unsupported capabilities, theme and narrow layout     |

Unit tests own state/payload/log invariants. Protocol tests spawn the built stdio
server and inspect actual tools/resources. Browser tests exercise real UI actions
over the standalone adapter and SDK test host. Host fixtures may simulate chat
acknowledgment but must forward domain tool calls to the actual server. Test both
JSON-RPC errors and successful transport containing a tool/application error.

On this Mac, follow the installed `macos-browser-testing.md`: disposable browser
profile and approved unsandboxed launch. Do not retry LaunchServices/WindowServer
failures unchanged. Keep logs/screenshots in disposable or ignored artifact paths.

For actual host acceptance, check the installed package build and live panel build,
then send a harmless explicitly authorized message and inspect its corresponding
conversation turn. If live acceptance is unavailable, state that limit. A test
host or fresh CLI probe does not establish the active desktop connection's build.
