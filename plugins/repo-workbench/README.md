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
npm install --prefix "$HOME/.local/share/repo-workbench" /absolute/repo-kit-workbench-0.1.1.tgz --ignore-scripts
"$HOME/.local/share/repo-workbench/node_modules/.bin/repo-workbench" setup --scope user
```

Setup merges one entry into `~/.agents/plugins/marketplace.json`, preserving other plugins. It prints the exact `codex plugin add NAME@MARKETPLACE` command for the existing catalog name. First register the catalog with `codex plugin marketplace add "$HOME"`, then run the printed install command. The CLI remains at the path above; add that `node_modules/.bin` directory to PATH if desired.

### Repository-scoped

From the target repository:

```sh
npm install --save-dev /absolute/repo-kit-workbench-0.1.1.tgz --ignore-scripts
npx --no-install repo-workbench setup --scope repo
```

Setup merges the repository's `.agents/plugins/marketplace.json` and `.codex/config.toml`. It enables the repository's package and disables other `repo-workbench@…` identities found in the user or project configuration **only for this project**. User configuration is read from `$CODEX_HOME/config.toml` (default `~/.codex/config.toml`) and is never changed. Unrelated plugins/settings and existing comments are preserved. Run setup again after adding another user-level Workbench installation; it is idempotent.

New repo catalogs receive distinct names. Existing names are preserved; a name shared with a user Workbench identity is rejected with instructions to choose a distinct name. Invalid TOML, unsupported inline/dotted plugin layouts, symlinked configuration paths, or concurrent file changes stop setup instead of replacing unrelated settings. Changed existing files are backed up in a private OS temporary directory printed as `backup`; retain that path if recovery is needed. Both files are validated first, and each is replaced atomically. An interruption between the two replacements is recoverable by rerunning setup; the pair is not a filesystem transaction.

Keep the catalog, project enablement, and npm lockfile in source control if sharing setup. Codex loads project settings only in trusted repositories. Open the trusted repository and refresh plugins or start a fresh chat; the runtime cache remains user-scoped. **Effective configuration and catalog discovery are verified with CLI 0.147.0; automatic materialization/activation is not yet verified.** Its model-free refresh still reported `installed=false` and `enabled=false`. The collective checklist in repo-kit at `docs/migrations/repo-workbench.md` tracks native activation, restart-dependent acceptance, and the final fix round. Do not use user-wide `plugin add` as a workaround for repo-only activation.

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

Call `canvas_open({repo: "/absolute/repository"})`. Every open returns an opaque context ID; subsequent app operations retain it. Each context owns its draft and discussion mailbox. Two repositories or chats never share a mutable global target. Opening from the app menu without a target asks the owning chat for its working directory once, then connects that same panel through `canvas_bind`. No repository is guessed from the plugin installation directory. Registered folders and manual path entry are fallbacks. A cancelled or expired request cannot retarget a panel. The user-level registry is optional and stores folder references, never maps or a global active target. The canonical path stays visible in the canvas.

The schema and location of existing saved maps are preserved. Source previews remain restricted to Git-visible repository files. Proposals require Apply to draft, then Save; stale revisions are rejected. A plugin installation location is never used as the repository default. The standalone CLI alone defaults `--repo` to the invoking working directory.

## Registered repositories and standalone server

```sh
repo-workbench repos add /absolute/repo --name "My project"
repo-workbench repos list
repo-workbench serve --port 4317
repo-workbench repos remove /absolute/repo
```

The registry lives at `$XDG_CONFIG_HOME/repo-workbench/repositories.json`, defaulting to `~/.config/repo-workbench/repositories.json`. Registration resolves the Git checkout root and deduplicates canonical paths. Removing an entry leaves repository files untouched. The hosted picker and the standalone launch page reload the list every five seconds. Missing folders stay visible as unavailable; active canvases never switch when the list changes.

`serve` starts a loopback-only, headless-capable process without opening a browser or model. Visit its printed URL to select a registered repository. Each repository route keeps its own state and source access, and browser drafts remain tab-local. Removing a registration hides it from new selections; existing server routes remain usable until that server restarts. This is a local trusted-user tool, not an authenticated remote service.

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

The optional `REPO_WORKBENCH_CODEX_BIN=/absolute/path/to/codex node --test tests/codex.test.ts` checks native configuration precedence, catalog isolation and package rediscovery after server restart. It uses a disposable Codex configuration and starts no model turn; desktop activation remains a separate check.

Build before tests because runtime renderers use the same prebuilt assets delivered to users. Run `npm run test:package` to pack and install into a fresh temporary consumer with lifecycle scripts disabled, then verify the CLI, MCP resource, two repositories, and offline export without this source checkout's dependencies.

Source extracted from Card Workshop commit `2db3b0d` (2026-10-20 review). Project maps, authored case specifications, private session logs, retained evidence, and game policy review remain owned by their repositories. Repo-kit's existing shared skills and Copier governance delivery are independent products.
