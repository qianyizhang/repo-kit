# Repo Workbench

- **Goal** · Inspect a repository and its recorded work locally. Node and Git provide the local runtime.
- **Surfaces** · Canvas, usage and trace run standalone or in the current Codex chat. File maps, session reviews and usage can open as offline HTML.

## Entry points

| Goal                                  | Codex                                                | Standalone                                               | Reference                                                      |
| ------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| Map Git-tracked files                 | `file_map({repo: "/absolute/repo"})`                 | `repo-workbench file-map --repo /absolute/repo`          | [File inventory](docs/file-map.md)                             |
| Read and revise architecture          | `canvas_open({repo: "/absolute/repo"})`              | `repo-workbench canvas --repo /absolute/repo`            | [Canvas](docs/canvas-design.md)                                |
| Inspect usage and drill into sessions | `usage_open({roots?: ["/absolute/log-root"]})`       | `repo-workbench usage --serve`                           | [Usage](docs/usage.md)                                         |
| Inspect a recorded trace              | `trace_open({session: "SESSION_ID", roots?: [...]})` | Full trace from local usage                              | [Session review](docs/session-review.md)                       |
| Export an authored evidence case      | Open the standalone export                           | `repo-workbench trace --repo ... --input ... --case ...` | [Case authoring](docs/session-review.md#add-a-case-or-episode) |

- **Host context, attachments and errors** · [MCP integration](docs/mcp-apps.md)

## Install

- **Output** · A local tarball with runtime code and UI assets. The delivered package has no production dependencies or install scripts.
- **Source build** · Node 24.21+ from this directory.

```sh
npm ci --prefix ../mcp-app-runtime
npm ci
npm pack
```

### User-wide

```sh
npm install --prefix "$HOME/.local/share/repo-workbench" /absolute/repo-kit-workbench-VERSION.tgz --ignore-scripts
"$HOME/.local/share/repo-workbench/node_modules/.bin/repo-workbench" setup --scope user
codex plugin marketplace add "$HOME"
# Run the plugin add command printed by setup.
```

- **Outcome** · One entry merged into `~/.agents/plugins/marketplace.json`. Setup prints the exact plugin identity in the existing catalog.
- **Activation** · Open a fresh chat. Refresh or restart Codex if it still shows the old catalog. Retire any old direct `mcp_servers.repo_canvas` registration after verifying the packaged plugin.

### Repository-scoped

```sh
npm install --save-dev /absolute/repo-kit-workbench-VERSION.tgz --ignore-scripts
npx --no-install repo-workbench setup --scope repo
```

- **Configuration** · Setup writes `.agents/plugins/marketplace.json` and `.codex/config.toml` to enable the repo's identity and disable other Workbench identities for that repo. Existing user configuration and unrelated entries stay intact.
- **Guardrails** · Setup rejects catalog-name collisions, unsupported or invalid TOML, symlinked config paths and concurrent edits. Changed files are backed up at the printed private path. Each file is replaced atomically. Rerunning setup recovers interruptions and reconciles newly added user versions.
- **Shareable setup** · Track the catalog, project config and npm lockfile. For repos without a root npm manifest, install to `--prefix .cache/repo-workbench-runtime` and invoke that CLI with `setup --scope repo --repo /absolute/repo`.
- **Activation** · Use the user-wide install for routine use. Repo-scoped catalog discovery is verified. Desktop activation remains open in repo-kit's `docs/backlog.md`.
- **Distribution** · Local tarball today. A registry release can use the same package with marketplace `source: "npm"`. [Plugin packaging](https://developers.openai.com/plugins/build/plugins)

## Repository identity and storage

| Material             | Location and authority                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Saved architecture   | `{repo}/.repo-canvas/architecture.json`. Durable and optionally Git-tracked. [Map format and save guarantees](docs/canvas-architecture.md) |
| Unsaved Canvas draft | Browser-tab recovery and opened context. Export before replacing a panel.                                                                  |
| Canvas discussion    | Private state by repository and chat. [Recovery contract](docs/canvas-architecture.md)                                                     |
| Repository registry  | `$XDG_CONFIG_HOME/repo-workbench/repositories.json` or `~/.config/repo-workbench/repositories.json`. Folder references.                    |
| Source logs          | Read-only Codex session roots or explicit `--root`. [Usage inputs and cache](docs/usage.md)                                                |
| Exports              | [File maps](docs/file-map.md), [usage](docs/usage.md) and [curated cases](docs/session-review.md) own their output locations.              |

- **Embedded target** · [Chat workspace and picker precedence](docs/canvas-design.md#repository-selection)
- **Standalone target** · The CLI defaults `--repo` to the invoking directory. Successful embedded opens register the canonical Git root. Registry writes preserve existing names and serialize concurrent additions.

## Registered repositories and standalone server

| Command                                                       | Outcome                                                                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `repo-workbench repos add /absolute/repo --name "My project"` | Add a canonical folder to the picker                                                                                              |
| `repo-workbench repos list`                                   | List registered folders                                                                                                           |
| `repo-workbench repos remove /absolute/repo`                  | Remove the picker entry. Existing routes remain usable until server restart.                                                      |
| `repo-workbench serve --port 4317`                            | Print a loopback URL for a trusted local user. Each route keeps its state and source access. Missing folders show as unavailable. |
| `repo-workbench canvas --repo /absolute/repo --validate`      | Validate the saved architecture                                                                                                   |

## Maintain and verify

| Check                                                                              | Evidence                                                                                                                            |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                                    | Format, lint, types, build and synthetic/unit tests                                                                                 |
| `npm run test:browser`                                                             | Built assets in real browser journeys. On this Mac, use approved execution outside the restricted sandbox with disposable profiles. |
| `npm run test:package`                                                             | Fresh consumer install with scripts disabled, CLI/MCP, two maps and export                                                          |
| `REPO_WORKBENCH_CODEX_BIN=/absolute/path/to/codex node --test tests/codex.test.ts` | Opt-in native configuration precedence, catalog isolation and rediscovery. Disposable config and no model turn.                     |

- **Source** · TypeScript, TSX, CSS and ESLint configuration. `prepack` rebuilds ignored `dist/`.
- **Provenance** · Extracted from Card Workshop `2db3b0d` (2026-10-20 review). Target repositories own maps, cases, private logs, retained evidence and policy.

### Canvas verification

- **Main journey** · Exercise source preview and edit, [proposal review](docs/canvas-design.md#proposal-comparison), stale edits, keyboard menus, export/import, Undo, Reload and panel close/reopen. Run the repository gate and Canvas browser suite.
- **Visual comparisons** · Use matched before/after captures at 1440×1000 desktop and 740×950 compact desktop host. Use 390×844 for mobile comparisons when mobile is in scope. Use the same saved map, root selection and 80% zoom. Retain full screenshots, annotate report crops only and label simulated hosts.
- **Accessibility** · Normal text contrast ≥4.5:1. Meaningful focus/control contrast ≥3:1. Check reduced motion and affected host and standalone themes. Existing comparison evidence covers dark close-button contrast and narrow light layout. App-wide claims need broader evidence.
- **Desktop release smoke test** · After refreshing the updated plugin, open a disposable Canvas in a fresh chat and send a question to its owning chat. Apply the returned proposal and verify that Save writes the intended map. Leave a second edit unsaved, reload, and verify draft recovery in the same repository.
- **Evidence** · Record actual Codex acceptance separately from protocol and simulated-host results.
