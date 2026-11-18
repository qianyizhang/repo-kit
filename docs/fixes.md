# Repo-kit audit backlog

The correctness audit and four follow-ups are complete in local source. The
original findings and reproductions remain in `e621979:docs/fixes.md`.
The follow-ups cover Canvas source-save reconciliation, portable work-item
rules, compact frozen evidence, and shared diagnostics. Their behavior belongs
to the product contracts and tests rather than this backlog.

## Deferred work

| Area | Revisit when | Smallest useful change |
|---|---|---|
| Trace parsing and ownership (C, B) | A recorded wrapper needs another parser change. | Analyze it once and compare observable results on existing fixtures. Move only contracts that remove reverse imports. |
| Discussion writes (G) | A typing-burst measurement shows unnecessary writes or latency. | Keep only the latest waiting draft. Verify Send and Clear flush in order and failures preserve input. |
| Generated viewers (H, I) | A real atlas or UI-review viewer feature needs build changes. | Add a generated-page smoke test first. Preserve portable output and editable data before replacing the bundler or splitting authoring files. |
| Verification cost (J) | Timings show repeat installs or duplicate runtime jobs dominate CI. | The pre-push gate now skips allowlisted docs-only updates; measure CI separately. Preserve release coverage and default uncertain changes to full checks. |
| Smaller maintenance candidates | The owning code changes or measured cost warrants work. | Preserve action-specific types in the Canvas dispatcher; reuse the Example poller only for matching lifecycles; measure orphaned usage-cache bytes and repeated archive decoding before adding cleanup or caching. |

## Delivery still open

Hosted CI, the opt-in native Codex check, and installed-host acceptance are
distinct from local test results. At the next authorized release, verify the
exact revision in CI and exercise the installed plugin after reload. Do not
propagate templates or overwrite downstream backlog pages as part of that check.
