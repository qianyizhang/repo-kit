# Repo Canvas

The architecture workbench module of [Repo Workbench](../../README.md).

`src/model` owns the versioned map and operation contract; `src/server` owns repository access, revision checks, per-opening contexts and transports; `src/ui` owns the hosted/standalone experience. Saved maps remain in the target repository at `.repo-canvas/architecture.json`.

See [installation, storage and checks](../../README.md), [design](../../docs/canvas-design.md), and [MCP host caveats](../../docs/mcp-apps.md).
