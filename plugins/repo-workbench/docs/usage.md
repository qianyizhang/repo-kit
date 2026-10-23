# Offline Codex usage dashboard

A local tool for analyzing Codex JSONL session logs and `.jsonl.zst` archives without proxies, accounts, or network calls.

## Quick start

```sh
repo-workbench usage --serve
```

Opens loopback server at `http://127.0.0.1:4381/`. Re-reads appended logs incrementally via disk index.

### Offline bundles and custom roots

```sh
# Generate self-contained offline HTML bundle
repo-workbench usage --out test-results/my-usage

# Custom roots and custom port
repo-workbench usage --root /path/to/sessions --serve --port 4382

# Verification
npm test
npm run test:browser -- tests/browser/usage-dashboard.spec.ts
```

Both modes initially show all recorded dates. The display follows the OS color mode standalone and the host color mode in Codex. Compressed sources show decoded and stored sizes; hashes and record offsets refer to decoded JSONL. Damaged archives appear as coverage gaps.

Default roots: `sessions` and `archived_sessions` in `$CODEX_HOME` or `~/.codex`.

## Views and analytics

- **Overview**: Token metrics (input, output, cache share, reasoning share), daily trends, 182-day activity heatmap, model/project breakdowns, and sortable session tables.
- **Filters**: Date range, model, project, effort, and search. Auto-review sessions (`codex-auto-review`) are excluded by default.
- **Pricing**: Standard rates (as of 2026-10-09) with configurable USD/million token rates. Applies 2× input / 1.5× output modifiers above 272K request tokens for eligible models.
- **Evidence & Trace**: Links to physical file lines and SHA-256 hashes. In `--serve` mode, links directly into the trace visualizer. Exports filtered rows to CSV.

## Metrics definitions

- `Total tokens = input + output`.
- `Cache share = cache_read / input`.
- `Reasoning share = recorded_reasoning / output`.
- Metrics track metered usage records, not prompt counts or turns.

## Accounting and indexing

- **Record precedence**: Modern `token_usage_record` `(thread_id, response_id)` takes precedence over legacy cumulative snapshots. Responses are globally deduplicated across archived/copied files.
- **Incremental indexing**: Maintained under `~/.cache/repo-workbench/usage/<root-key>/ (or `--cache` override)`. Tracks file size, mtime, and trailing 4 KiB to resume reading without reparsing unchanged prefixes.
- **Integrity**: Serialized SHA-256 states preserve exact whole-file hashes. Malformed lines and counter reconciliation mismatches (`input + output != total`) are logged as coverage gaps without halting scans.

## Code structure

- `packages/usage/`: Log scanning, incremental index, and pricing logic.
- `packages/usage/browser/`: Dashboard UI (`main.ts`, `charts.ts`, `evidence.ts`, `dom.ts`).
- `packages/session-review/`: Shared trace inspection views.
