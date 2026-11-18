# Offline Codex usage dashboard

- **Goal** · Analyze local Codex JSONL sessions and `.jsonl.zst` archives.
- **Source** · Read-only `sessions` and `archived_sessions` under `$CODEX_HOME` or `~/.codex`. Supply `--root` to choose other roots.

## Quick start

| Command                                                             | Outcome                                                                          |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `repo-workbench usage --serve`                                      | Loopback dashboard at `http://127.0.0.1:4381/` with session trace links          |
| `repo-workbench usage --root /path/to/sessions --serve --port 4382` | Custom roots and port                                                            |
| `repo-workbench usage --out test-results/my-usage`                  | Self-contained offline HTML. Default export uses a fresh OS temporary directory. |

## Views and analytics

| View             | Outcome                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview         | Token totals, daily trends, 182-day heatmap, model/project breakdowns and sortable sessions                                                    |
| Filters          | Dates, model, project, effort and search. Initial view spans all dates and hides sessions containing only `codex-auto-review` records.         |
| Pricing          | Configurable USD per million tokens. Standard rates dated 2026-10-09. Eligible events above 272,000 input tokens use 2× input and 1.5× output. |
| Evidence & Trace | Source lines and SHA-256, served trace links, filtered CSV and exact usage records                                                             |
| Theme            | OS theme standalone, host theme in Codex                                                                                                       |

## Metrics definitions

| Metric          | Formula                       |
| --------------- | ----------------------------- |
| Total tokens    | `input + output`              |
| Cache share     | `cache_read / input`          |
| Reasoning share | `recorded_reasoning / output` |

- **Unit** · Metered usage records.

## Accounting and indexing

- **Record identity** · Modern `token_usage_record` keyed by `(thread_id, response_id)` takes precedence over cumulative snapshots. Deduplicate responses across archived/copied files.
- **Index** · `$XDG_CACHE_HOME/repo-workbench/usage` or `~/.cache/repo-workbench/usage`, partitioned by root key. Override with `--cache`.
- **Reuse** · Unchanged device, inode, size, mtime and ctime allow a cache hit. Growing plain logs require a complete hash check of the old prefix. Mismatch triggers reparse. Bytes scanned includes verification. A partial last line is parsed again.
- **Integrity** · Serialized SHA-256 state preserves exact whole-file hashes. For archives, hashes and offsets refer to decoded JSONL. Stored and decoded sizes are visible. Damaged archives, malformed lines and counter mismatches appear as coverage gaps.

## Refresh and evidence

| Situation                      | Outcome                                                                                                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reopen after a successful scan | Timestamped cached summary remains available during background refresh. Discussion can use the cached summary. Source inspection waits for the current index.                                                                                |
| Refresh fails                  | Cached summary stays visible. **Refresh logs** offers retry.                                                                                                                                                                                 |
| Refresh succeeds               | Panel adopts a new revision and retains filters and draft. Active traces remain pinned until deliberate refresh.                                                                                                                             |
| Inspect or export              | Embedded summaries include exact event counts, reasoning coverage and pricing bands. Inspection loads up to 100 exact records. CSV includes all filtered records. Offline HTML retains complete usage records and uses the same aggregation. |
| Diagnose slow load             | Panel status exposes initial load time. Protocol status exposes index, scan, summary and persistence timings.                                                                                                                                |

- **Host context** · [Report discussion and attachments](mcp-apps.md#reports-and-conversation-context)
- **Owners** · `packages/usage/` for scanning, index and pricing, `packages/usage/browser/` for dashboard presentation, `packages/session-review/` for trace views.
- **Checks** · `npm test` and `npm run test:browser -- tests/browser/usage-dashboard.spec.ts`.
