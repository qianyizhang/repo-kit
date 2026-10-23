# Repo Workbench

Repository architecture and recorded coding-session review. Canvas, usage and
trace are MCP Apps in the current Codex chat and also work standalone. Session
review and usage retain offline HTML exports. Runtime needs no model process,
API key, account or network service.

## Entry points

| Task                   | Codex MCP App                                                                 | Standalone                                               |
| ---------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| Architecture           | `canvas_open({repo: "/absolute/repo"})`                                       | `repo-workbench canvas --repo /absolute/repo`            |
| Usage                  | `usage_open({roots?: ["/absolute/log-root"]})`                                | `repo-workbench usage --serve` or offline export         |
| Recorded trace         | `trace_open({session: "SESSION_ID", roots?: [...]})` or full trace from usage | Full trace from local usage                              |
| Authored evidence case | Open its standalone export                                                    | `repo-workbench trace --repo ... --input ... --case ...` |

Canvas proposals require Apply to draft, then Save; source edits have a separate
reviewed save. Reports read recorded evidence. See [Canvas](docs/canvas-design.md),
[session review](docs/session-review.md), and [usage](docs/usage.md) for behavior.
[MCP integration](docs/mcp-apps.md) owns message attachments, context expiry,
connection recovery and diagnostics.

## Install

Build a local package from this directory with Node 24.21+:

```sh
npm ci --prefix ../mcp-app-runtime
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

Keep the catalog, project enablement, and npm lockfile in source control if sharing setup. Codex loads project settings only in trusted repositories. Open the trusted repository and refresh plugins or start a fresh chat; the runtime cache remains user-scoped. **The historical CLI 0.147.0 check verified configuration/discovery but not repo-scoped activation:** model-free refresh reported `installed=false` and `enabled=false`. The collective checklist in repo-kit at `docs/migrations/repo-workbench.md` tracks native activation, restart-dependent acceptance, and the final fix round. Do not use user-wide `plugin add` as a workaround for repo-only activation.

For a Markdown-only repository that should not acquire a root npm manifest, install with `npm install --prefix .cache/repo-workbench-runtime /absolute/package.tgz --ignore-scripts`, then invoke that installation's CLI with `setup --scope repo --repo /absolute/repo`. This runtime cache can be recreated; the saved architecture is elsewhere.

Registry distribution can later use the same prebuilt npm package in a marketplace's `source: "npm"` entry. Nothing in this migration publishes the package. See [official plugin packaging](https://developers.openai.com/plugins/build/plugins).

After installation or an update, open a fresh Codex chat; restart the app if it retains an older tool catalog. Existing chats may keep their old server until reloaded. Remove an old direct `mcp_servers.repo_canvas` registration only after the packaged plugin is verified.

## Repository identity and storage

| Material             | Location and authority                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Saved architecture   | `{repo}/.repo-canvas/architecture.json`; durable, optionally Git-tracked                                                         |
| Unsaved canvas draft | Browser-tab recovery and opened canvas context; export before replacing a panel                                                  |
| Canvas discussion    | Private `$XDG_STATE_HOME/repo-workbench/discussions` or `~/.local/state/repo-workbench/discussions`; repository/chat partitioned |
| Repository registry  | `$XDG_CONFIG_HOME/repo-workbench/repositories.json` or `~/.config/repo-workbench/repositories.json`; folder references only      |
| Source logs          | Existing Codex session locations or explicit `--root`; read-only                                                                 |
| Usage index          | `$XDG_CACHE_HOME/repo-workbench/usage` or `~/.cache/repo-workbench/usage`; rebuildable, `--cache` override                       |
| Usage export         | Fresh OS temporary directory, or explicit `--out` for retained output                                                            |
| Curated review       | Fresh `{repo}/.cache/repo-workbench/reviews` directory, or explicit `--out`                                                      |

Embedded Canvas resolves the calling chat's workspace; registered folders and
manual entry are fallbacks. It never guesses from the plugin directory or another
panel. The standalone CLI defaults `--repo` to its invoking working directory.
Maps use v3; older/invalid files need offline repair or a new draft and explicit Save.

## Registered repositories and standalone server

```sh
repo-workbench repos add /absolute/repo --name "My project"
repo-workbench repos list
repo-workbench serve --port 4317
repo-workbench repos remove /absolute/repo
```

Successful embedded opens remember canonical Git roots. Both pickers support
search and Add another repository; no filesystem scan is performed. Concurrent
registrations are serialized and preserve existing display names. Removing an
entry leaves repository files and already-open targets untouched.

`serve` prints a loopback URL without opening a browser or model. Registered
folders refresh while choosing; missing folders remain visible as unavailable.
Each route keeps its own state/source access; removing a registration leaves an
existing route usable until server restart. This is a local trusted-user service.

## Use without Codex

```sh
repo-workbench canvas --repo /absolute/repo --validate
repo-workbench usage --serve
repo-workbench usage --root /logs --cache /cache --out /fresh/report
repo-workbench trace --repo /repo --input exports --case case.json --out reviews/new
```

The [session-review guide](docs/session-review.md) owns case authoring, capture
patterns and evidence limits. Project conventions stay in the authored case.

## Maintain and verify

Author TypeScript/TSX and CSS; the ESLint `.mjs` configuration is also source.
`dist/` is Git-ignored package output, rebuilt by `prepack`.

```sh
npm run check
npm run test:browser
npm run test:package
```

`check` covers formatting, lint, types, build and synthetic/unit tests. Build
before browser tests because they use delivered assets. On this Mac, launch the
browser suite with approved execution outside the restricted sandbox; its startup
guard uses disposable profiles and stops on launch failure. Package checks install
into a fresh consumer with scripts disabled and verify CLI/MCP, two maps and export.

The optional `REPO_WORKBENCH_CODEX_BIN=/absolute/path/to/codex node --test tests/codex.test.ts`
checks configuration precedence, catalog isolation and rediscovery with disposable
configuration and no model turn. Desktop activation remains separate.

[Canvas](docs/canvas-design.md#implementation-owners) owns model/draft boundaries;
[MCP integration](docs/mcp-apps.md) owns host and transport boundaries. For
connection failures, use the [diagnostic procedure](docs/mcp-apps.md#connection-diagnostics).

Source was extracted from Card Workshop commit `2db3b0d` (2026-10-20 review).
Project maps, cases, private logs, retained evidence and game policy stay with
their repositories. Shared skills and Copier governance are separate products.
