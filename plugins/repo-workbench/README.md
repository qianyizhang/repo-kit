# Repo Workbench

An optional repo-kit plugin for repository architecture and recorded coding-session review. Canvas is an MCP App in the current Codex chat; session review and usage run locally and export self-contained HTML. No model process, API key, account, or network service is required by the runtime.

## Install

Build a local package from this directory with Node 24.21+:

```sh
npm ci
npm run build
npm pack
```

The tarball includes all runtime code and UI assets, with no production dependency installation or lifecycle scripts. It can be installed using npm at user scope or in a repository. The package is not published to a registry yet; use the absolute tarball path below.

### User-wide

```sh
npm install --prefix "$HOME/.local/share/repo-workbench" /absolute/repo-kit-workbench-0.1.0.tgz --ignore-scripts
"$HOME/.local/share/repo-workbench/node_modules/.bin/repo-workbench" setup --scope user
```

Setup merges one entry into `~/.agents/plugins/marketplace.json`, preserving other plugins. It prints the exact `codex plugin add NAME@MARKETPLACE` command for the existing catalog name. First register the catalog with `codex plugin marketplace add "$HOME"`, then run the printed install command. The CLI remains at the path above; add that `node_modules/.bin` directory to PATH if desired.

### Repository-scoped

From the target repository:

```sh
npm install --save-dev /absolute/repo-kit-workbench-0.1.0.tgz --ignore-scripts
npx --no-install repo-workbench setup --scope repo
```

Setup writes the repository's `.agents/plugins/marketplace.json`, pointing at its local npm installation. It prints an `enable` object: merge its `toml` snippet into its `file` (`.codex/config.toml`), preserving other configuration. Then open the trusted repository in Codex and refresh plugins or start a fresh chat. Repo setup does not run or recommend the user-wide CLI activation commands above. Keep the catalog, project enablement, and npm lockfile in source control if sharing setup.

New repo catalogs receive distinct names so two repositories can use different package versions without sharing a plugin identity. Existing catalog names are preserved. Codex still caches installed files at user scope; activation belongs to the trusted project's configuration. An existing user-wide installation remains enabled independently; repo setup does not disable it.

For a Markdown-only repository that should not acquire a root npm manifest, install with `npm install --prefix .cache/repo-workbench-runtime /absolute/package.tgz --ignore-scripts`, then invoke that installation's CLI with `setup --scope repo --repo /absolute/repo`. This runtime cache can be recreated; the saved architecture is elsewhere.

Registry distribution can later use the same prebuilt npm package in a marketplace's `source: "npm"` entry. Nothing in this migration publishes the package. See [official plugin packaging](https://developers.openai.com/plugins/build/plugins).

After installation or an update, open a fresh Codex chat; restart the app if it retains an older tool catalog. Existing chats may keep their old server until reloaded. Remove an old direct `mcp_servers.repo_canvas` registration only after the packaged plugin is verified.

## Repository identity and storage

| Material                 | Location and authority                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Saved architecture       | `{repo}/.repo-canvas/architecture.json`; durable, optionally Git-tracked                      |
| Unsaved canvas draft     | Browser-tab recovery plus the opened canvas's in-memory context                               |
| Source logs              | Existing Codex session locations or explicit `--root`; read-only                              |
| Rebuildable usage index  | `$XDG_CACHE_HOME/repo-workbench/usage` or `~/.cache/repo-workbench/usage`; override `--cache` |
| Generated usage report   | Fresh OS temporary directory; override `--out` for retained output                            |
| Generated curated review | `{repo}/.cache/repo-workbench/reviews`; override `--out` for retained output                  |

Call `canvas_open({repo: "/absolute/repository"})`. Every open returns an opaque context ID; subsequent app operations retain it. Each context owns its draft and discussion mailbox. Two repositories or chats never share a mutable global target. Opening from the app menu without a target displays a repository picker. No global repository registry is required. The canonical path stays visible in the canvas.

The schema and location of existing saved maps are preserved. Source previews remain restricted to Git-visible repository files. Proposals require Apply to draft, then Save; stale revisions are rejected. A plugin installation location is never used as the repository default. The standalone CLI alone defaults `--repo` to the invoking working directory.

## Use without Codex

```sh
repo-workbench canvas --repo /absolute/repo
repo-workbench canvas --repo /absolute/repo --validate
repo-workbench usage --serve
repo-workbench usage --root /logs --cache /cache --out /fresh/report
repo-workbench trace --repo /repo --input exports --case case.json --out reviews/new
```

A curated case declares `assetRoot`, `captureSubjects`, and `captureViews` (view names mapped to filename patterns containing `{subject}`) when collecting images. Those project conventions live in the case, not the generic renderer. Existing recorded identities, hash navigation, source hashes, lazy body checks, and review uncertainty remain intact. See [session review](docs/session-review.md), [usage](docs/usage.md), and [Canvas design](docs/canvas-design.md).

## Maintain and verify

`npm run check` covers formatting, typed lint, types, synthetic parser/export/usage tests, repository/MCP tests, and the packaged build. `npm run test:browser` exercises Canvas's hosted/standalone flow and the review/usage journeys. On macOS run browser-launching commands outside the restricted sandbox from the first launch; the startup guard uses disposable Chrome profiles and stops on startup failure.

Build before tests because runtime renderers use the same prebuilt assets delivered to users. Run `npm run test:package` to pack and install into a fresh temporary consumer with lifecycle scripts disabled, then verify the CLI, MCP resource, two repositories, and offline export without this source checkout's dependencies.

Source extracted from Card Workshop commit `2db3b0d` (2026-10-20 review). Project maps, authored case specifications, private session logs, retained evidence, and game policy review remain owned by their repositories. Repo-kit's existing shared skills and Copier governance delivery are independent products.
