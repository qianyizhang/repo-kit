# Repo Workbench

An optional repo-kit plugin for repository architecture and recorded coding-session review. Canvas is an MCP App in the current Codex chat; session review and usage run locally and export self-contained HTML. No model process, API key, account, or network service is required by the runtime.

## Install

Build a local package from this directory with Node 24.21+:

```sh
npm ci
npm run build
npm pack
```

The tarball includes all runtime code and UI assets, with no production dependency installation or lifecycle scripts. It can be installed using npm at user scope or in a repository. The package is not published to a registry yet; replace the example tarball path below with the file produced by `npm pack`.

### User-wide

```sh
npm install --prefix "$HOME/.local/share/repo-workbench" /absolute/repo-kit-workbench-VERSION.tgz --ignore-scripts
"$HOME/.local/share/repo-workbench/node_modules/.bin/repo-workbench" setup --scope user
```

Setup merges one entry into `~/.agents/plugins/marketplace.json`, preserving other plugins. It prints the exact `codex plugin add NAME@MARKETPLACE` command for the existing catalog name. First register the catalog with `codex plugin marketplace add "$HOME"`, then run the printed install command. The CLI remains at the path above; add that `node_modules/.bin` directory to PATH if desired.

### Repository-scoped

From the target repository:

```sh
npm install --save-dev /absolute/repo-kit-workbench-VERSION.tgz --ignore-scripts
npx --no-install repo-workbench setup --scope repo
```

Setup merges the repository's `.agents/plugins/marketplace.json` and `.codex/config.toml`. It enables the repository's package and disables other `repo-workbench@…` identities found in the user or project configuration **only for this project**. User configuration is read from `$CODEX_HOME/config.toml` (default `~/.codex/config.toml`) and is never changed. Unrelated plugins/settings and existing comments are preserved. Run setup again after adding another user-level Workbench installation; it is idempotent.

New repo catalogs receive distinct names. Existing names are preserved; a name shared with a user Workbench identity is rejected with instructions to choose a distinct name. Invalid TOML, unsupported inline/dotted plugin layouts, symlinked configuration paths, or concurrent file changes stop setup instead of replacing unrelated settings. Changed existing files are backed up in a private OS temporary directory printed as `backup`; retain that path if recovery is needed. Both files are validated first, and each is replaced atomically. An interruption between the two replacements is recoverable by rerunning setup; the pair is not a filesystem transaction.

Keep the catalog, project enablement, and npm lockfile in source control if sharing setup. Codex loads project settings only in trusted repositories. Open the trusted repository and refresh plugins or start a fresh chat; the runtime cache remains user-scoped. **Effective configuration and catalog discovery are verified with CLI 0.147.0; automatic materialization/activation is not yet verified.** Its model-free refresh still reported `installed=false` and `enabled=false`. The collective checklist in repo-kit at `docs/migrations/repo-workbench.md` tracks native activation, restart-dependent acceptance, and the final fix round. Do not use user-wide `plugin add` as a workaround for repo-only activation.

For a Markdown-only repository that should not acquire a root npm manifest, install with `npm install --prefix .cache/repo-workbench-runtime /absolute/package.tgz --ignore-scripts`, then invoke that installation's CLI with `setup --scope repo --repo /absolute/repo`. This runtime cache can be recreated; the saved architecture is elsewhere.

Registry distribution can later use the same prebuilt npm package in a marketplace's `source: "npm"` entry. Nothing in this migration publishes the package. See [official plugin packaging](https://developers.openai.com/plugins/build/plugins).

After installation or an update, open a fresh Codex chat; restart the app if it retains an older tool catalog. Existing chats may keep their old server until reloaded. Remove an old direct `mcp_servers.repo_canvas` registration only after the packaged plugin is verified.

## Repository identity and storage

| Material                 | Location and authority                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved architecture       | `{repo}/.repo-canvas/architecture.json`; durable, optionally Git-tracked                                                                        |
| Unsaved canvas draft     | Browser-tab recovery plus the opened canvas's in-memory context                                                                                 |
| Canvas discussion        | Private state under `$XDG_STATE_HOME/repo-workbench/discussions` or `~/.local/state/repo-workbench/discussions`; partitioned by repository/chat |
| Source logs              | Existing Codex session locations or explicit `--root`; read-only                                                                                |
| Rebuildable usage index  | `$XDG_CACHE_HOME/repo-workbench/usage` or `~/.cache/repo-workbench/usage`; override `--cache`                                                   |
| Generated usage report   | Fresh OS temporary directory; override `--out` for retained output                                                                              |
| Generated curated review | `{repo}/.cache/repo-workbench/reviews`; override `--out` for retained output                                                                    |

Call `canvas_open({repo: "/absolute/repository"})`. Every open returns an opaque context ID; subsequent app operations retain it. Each context owns its map draft. Panels in the same repository/chat share durable discussion history; different repositories/chats have separate mailboxes. Two repositories or chats never share a mutable global target. Opening from the app menu without a target resolves the calling chat’s workspace from native request metadata and connects directly, without submitting a chat message. No repository is guessed from the plugin installation directory. Registered folders and manual path entry are fallbacks. A cancelled or expired request cannot retarget a panel. The user-level registry is optional and stores folder references, never maps or a global active target. The canonical path stays visible in the canvas.

Saved maps use v3 only; old/invalid files require offline repair or a new draft, then explicit Save. Source blocks use `path#L10-L25`; editing existing Git-visible text requires diff review and a revision-checked source-file save, separate from map Save. Proposals require Apply to draft, then Save; stale revisions are rejected. A plugin installation location is never used as the repository default. The standalone CLI alone defaults `--repo` to the invoking working directory.

## Registered repositories and standalone server

```sh
repo-workbench repos add /absolute/repo --name "My project"
repo-workbench repos list
repo-workbench serve --port 4317
repo-workbench repos remove /absolute/repo
```

Successfully opened embedded canvases remember their repository on this device. Both pickers offer searchable saved repositories and an **Add another repository** form that opens and remembers a folder. No filesystem scan is performed; existing Codex projects can be registered through `repos add`.

The registry lives at `$XDG_CONFIG_HOME/repo-workbench/repositories.json`, defaulting to `~/.config/repo-workbench/repositories.json`. Registration resolves the Git checkout root and deduplicates canonical paths. Concurrent chat/server registrations are serialized; existing display names survive automatic remembering. Removing an entry leaves repository files untouched. The hosted picker and the standalone launch page reload the list every five seconds. Missing folders stay visible as unavailable; active canvases never switch when the list changes.

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

Automatic connection uses the host-provided `_meta.threadId` (or matching `thread_id` alias),
then an exact-ID, read-only lookup of `cwd` in the newest `state_N.sqlite` under
`CODEX_HOME` (default `~/.codex`). This is a Codex-specific adapter, not a portable
MCP guarantee. Missing metadata, unknown database schemas, missing workspaces and
non-Git tasks fall back to the picker. It never scans conversation bodies or
chooses the last-used repository. The desktop-bundled Codex 0.163.0-alpha.10.2
was probed through `mcpServer/tool/call`: it provided `threadId` and no workspace
path. Empty new chats can have an ID before their workspace is persisted. The picker explains this gap, retries automatically every five seconds while visible, and reports the outcome of manual retry. Choosing a repository explicitly works immediately and is not overridden when the chat is later persisted. The plugin cannot read the project selector when Codex does not supply it. Repeat the isolated, model-free probe with
`REPO_WORKBENCH_CODEX_BIN=/absolute/path/to/codex node tests/probe-metadata.ts`.

Each mounted panel has its own identity. After a server restart, a confirmed
missing-context response reconnects to that panel’s selected repository and
restores its in-memory draft/view. A transport timeout does not replay mutations.
Closing/recreating a panel has a different recovery boundary: browser storage may
be unavailable, so export unsaved drafts before replacing the whole panel.
Connection uses the typed `connect` operation. Panels never send automatic chat messages.
After upgrading from an earlier app protocol, reopen the panel after refreshing the server.

## Connection diagnostics

The **ⓘ Connection information** control beside the header shows panel/server versions and build fingerprints, server start time and process/instance IDs, repository, caller chat, context, and local log path. It warns when builds differ. Its compact symbol controls copy details, refresh status, and download the connection log; tooltips and accessible names identify each action. The JSON report
includes the last 200 browser bridge events and server connection events, versions,
server identity, caller metadata key names and thread ID, panel/context IDs, errors, and timings. If the host is unavailable,
the download still includes the browser history after a five-second collection timeout.
Initialization failures can be retried without reloading the panel.

The stdio MCP server also keeps local JSONL logs at
`$XDG_CACHE_HOME/repo-workbench/canvas/connection.jsonl` (default
`~/.cache/repo-workbench/canvas/connection.jsonl`; an explicit `XDG_CONFIG_HOME` is
used as the fallback for isolated installations/tests). Rotation retains the current
file and one previous `.1` file, approximately 512 KiB each. New files are private
(mode 0600). Logging failure does not block opening; it appears in the report.
`canvas_diagnostics` lets the owning chat read recent server events and the log path.
Logs include repository paths and operational errors, but no source bodies, map/draft
payloads, or chat messages. Review paths before sharing a downloaded report.

Directory discovery supports filesystem names such as Astro/Next dynamic routes, Unicode, spaces,
and long paths without treating them as document IDs; saved maps keep their existing IDs.

## Maintained application contracts

Author `.ts`/`.tsx` and CSS; `dist/` is generated, Git-ignored, and explicitly included in the npm package. `prepack` rebuilds it. The authored ESLint `.mjs` configuration stays tracked.

`model/contracts.ts` owns operation inputs and results for HTTP and MCP. The client infers results from the action and validates external JSON; saved-map semantic validation remains in `model/document.ts`. The MCP app tool carries `{contextId?, request: {action, args}}`. Removed binding-ticket routes have no compatibility layer.

The UI uses the official MCP Apps SDK through `ui/host-client.ts`; `ui/host.ts` owns repository selection and restart recovery. `useCanvasDocument` owns drafts, revision conflicts, history and saves; `RepositoryPicker` owns selection UI. Codex is the acceptance target. Later Pi/DeepSeek harness experiments should adapt host capabilities, not duplicate application semantics or assume Codex's SQLite layout.

MCP Apps SDK 1.7.5 is pinned to stay compatible with MCP SDK 1.x. SDK 2.x requires a separate coordinated server migration. The packaged UI URI includes the build fingerprint, which covers source, static assets, build configuration and the dependency lockfile. Both server and UI report the same identity; this does not refresh an already running server process.
