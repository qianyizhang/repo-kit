# repo-kit

Personal Codex instructions, shared agent skills and a separate [Copier](https://copier.readthedocs.io/)
governance template, plus the optional [Repo Workbench
plugin](plugins/repo-workbench/README.md). `skills/` owns the shared skill bundle;
`template/` owns portable governance; `plugins/` owns executable development tools. Root
[AGENTS.md](AGENTS.md) governs maintenance here. `user/` owns the personal working
core and on-demand [practice guides](docs/user-instructions.md#sources).

## Personal instructions

Review and install the working core and TypeScript/React, Python, Apple-native
and UI/UX guides independently of skills and repository governance:

```sh
python3.12 scripts/user_instructions.py diff
python3.12 scripts/user_instructions.py sync
python3.12 scripts/user_instructions.py check
```

Unmanaged existing files require reviewed adoption first. See
[adoption, drift protection and recovery](docs/user-instructions.md).

For local or cloud delivery work, issues, PRs and follow-up comments, use the shared
[GitHub delivery guide](user/practices/github.md).

The [read-only issue queue CLI](docs/issue-queue.md) inspects explicit issue
receipts with `queue`, `status`, `next` and `check`; its fixture mode needs no
credentials. Recommendations do not dispatch or authorize work.

## Shared skills

The locked bundle includes upstream-derived workflows, declared local adaptations
and local skills. It is installed once for your user account. From this repository:

```sh
python3.12 scripts/skills.py diff
python3.12 scripts/skills.py sync
python3.12 scripts/skills.py check
```

See [pinning, update review, recovery and local mappings](docs/skill-suite.md).
Shared skills are no longer copied by Copier. Project-specific skills stay local.

The [core model and decisions](docs/models.md) explain how
Candidates, Campaigns, the portable product, and consumer bindings relate.

## Repo Workbench

Repo Canvas, recorded-session review, trace reading and usage analytics are delivered as
one standalone npm-compatible plugin. Install at user or repository scope; saved
architecture stays in the target repository. Plugin builds and dependencies are isolated
from shared skills and Copier. See its [installation and
checks](plugins/repo-workbench/README.md).

Track deferred desktop/manual acceptance and the final fix round in the
[collective migration checklist](docs/migrations/repo-workbench.md).

## Ownership contract

Among paths delivered by `template/`, those outside Copier's `_skip_if_exists`
list are kit-managed: portable doctrine, checks and agent bootstrap.
`copier update` merges template changes against the recorded baseline; review conflicts
and local edits before accepting the managed result.

True seeds and bindings stay consumer-owned: the consumer constitution, index,
backlog, glossary and local configuration. Copier
distributes shared behavior; it does not own local meaning.

Each consumer records its source revision in `.copier-answers.yml`. Reconcile
updates from that `_commit`. Tags are preferred release checkpoints, not the
only valid source revisions.

## Apply or update

Inspect the consumer baseline and reconcile local bindings around the Copier
operation. Replace `<approved-revision>` with the reviewed tag or
commit for both adoption and update:

```bash
# first adoption
UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools \
  uvx --from copier==9.17.1 copier copy --vcs-ref <approved-revision> ~/pkgs/repo-kit <target-repo>

# update from the recorded source
cd <target-repo>
UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools \
  uvx --from copier==9.17.1 copier update --vcs-ref <approved-revision>
```

Without `--vcs-ref`, Copier normally selects the latest version tag, which can
lag source `HEAD`. An explicit commit selects that reviewed state without
creating a release checkpoint; tagging and propagation remain separate actions.

Review preserved bindings and run the consumer's checks before accepting an
update. When moving from a Claude-owned baseline, follow the
[migration handoff](.codex/skills/maintain-repo-kit/references/migration-handoff.md)
before updating: preserve local policy in `AGENTS.md` and reduce `CLAUDE.md` to
its discovery pointer.

## Local artifacts

Follow [artifact and verification rules](user/practices/artifacts.md). Temporary
review bundles live in ignored `.artifacts/<outcome>/`; closeout deletes them after
promoting useful decisions. Build output, caches and recovery data keep their
existing locations and are removed when no active process or recovery needs them.
Completed review outcomes are condensed in [review notes](docs/reviews/README.md).

## Verify repo-kit

Enable the tracked pre-push gate once per clone:

```sh
git config --local core.hooksPath .githooks
```

If a clone already uses custom hooks, integrate this hook with that setup instead
of replacing it. The gate exports each outgoing commit tip and runs `npm ci` for
each tracked standalone npm package with a separate empty cache. It preserves
the working checkout and blocks a failed install. Package-manager registry and
authentication settings still apply. For each outgoing tip, the gate reads its
`.nvmrc` (the gate checkout's pin for older, unpinned tips) and the packages' shared
exact npm `packageManager` pin. It uses a matching pair from `PATH`, or selects
the pinned Node installation under
`${NVM_DIR:-~/.nvm}/versions/node/` without changing your shell default. CI uses
the same `.nvmrc`. No `nvm use` is needed before pushing. Missing or mismatched
tools block before installation with a one-time setup command; the gate never
downloads toolchains. Package engines remain enforced by `npm ci`.
Ref deletions skip installation. The same gate runs in CI because local hooks can
be bypassed. This repository's npm packages each own a sibling lockfile.

To check a committed candidate directly:

```sh
python3.12 scripts/check_npm_install.py --revision HEAD
```

The [root CI job](.github/workflows/root-checks.yml) runs the same source, unit and
Ruff checks on pushes and pull requests. It does not install personal instructions.
Use Python 3.12 and pinned tools; the root stays manifest-free:

```sh
python3.12 scripts/skills.py check --source-only
python3.12 -m unittest discover -s tests -v
UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools uvx --from ruff==0.16.3 ruff format --check --config template/ruff_base.toml scripts template/scripts tests .codex/skills/maintain-repo-kit/scripts skills/mcp-app/scripts skills/ui-discussion/scripts
UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools uvx --from ruff==0.16.3 ruff check --config template/ruff_base.toml scripts template/scripts tests .codex/skills/maintain-repo-kit/scripts skills/mcp-app/scripts skills/ui-discussion/scripts
```

For `template/` or Copier changes, run with `REPO_KIT_COPIER_SMOKE=1` against a
reviewed candidate index; use a disposable checkout to exclude unrelated staging.
For user instructions, review `diff`, run `sync`, then `check`.
For executable plugin changes, use Node 24.21+. Install and check
`plugins/mcp-app-runtime` first, then run `npm run check` and
`npm run test:browser` in each changed plugin (`repo-workbench` and/or
`example-mcp-app`). Shared runtime changes require both plugin suites. For browser tests on this Mac,
read [Mac browser testing](user/practices/macos-browser-testing.md).

For the MCP App skill's executable starter, generate into a new temporary directory
with `skills/mcp-app/scripts/scaffold.py`, then run `npm ci`, `npm run check` and
`npm run test:browser` there. The [starter CI job](.github/workflows/mcp-app-skill.yml)
exercises that same generated app. The root tests cover generator safety and the
MCP integration review validator; neither check alone verifies an app integration.

Use [finish-work](skills/finish-work/SKILL.md) to review and close a completed
slice, committing when requested. [Review notes](docs/reviews/README.md)
summarize its adoption; local bindings reuse each project's existing rules.
