# repo-kit

| Product | Outcome | Owner |
| --- | --- | --- |
| Personal instructions | One set of Codex defaults and practice guides per user | [Instruction maintenance](docs/user-instructions.md) |
| Shared skills | One pinned skill bundle per user | [Skill maintenance](docs/skill-suite.md) |
| Governance template | Shared rules and checks with repository-owned bindings | [Copier delivery](#apply-or-update) |
| Repo Workbench | Local architecture, file inventory, session review and usage tools | [Workbench](plugins/repo-workbench/README.md) |

- **Installed bundles** · [Version and integrity status](docs/installation.md)
- **Issue receipts** · [Read-only queue and readiness checks](docs/issue-queue.md)
- **Maintenance** · [Repository rules](AGENTS.md) · [Ownership and decisions](docs/models.md) · [GitHub delivery](user/practices/github.md)
- **Evidence** · [Artifact rules](user/practices/artifacts.md) · [Backlog](docs/backlog.md)

## Apply or update

- **Goal** · Deliver portable governance while preserving consumer policy, navigation and bindings.
- **Baseline** · The consumer's `.copier-answers.yml` records the source `_commit`. Choose a reviewed tag or commit explicitly. Copier's default tag selection can lag local HEAD.
- **Adoption outcome** · Repository bindings and authority frontmatter complete, governance settings integrated into `pyproject.toml`, and the local agent discovery layout generated with `scripts/bootstrap_agents.py`.
- **Consumer checks** · `scripts/check_docs.py` passes in the consumer lint gate. Authoring and file-size checks provide advisory feedback. Use the consumer's supported Python.
- **Update acceptance** · Reviewed conflicts and local edits, preserved bindings, passing consumer checks.
- **Older baselines** · [Migration handoff](.codex/skills/maintain-repo-kit/references/migration-handoff.md)

```sh
# Adopt from outside the target repository.
UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools \
  uvx --from copier==9.17.1 copier copy --vcs-ref <approved-revision> ~/pkgs/repo-kit <target-repo>

# Update from the target repository.
UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools \
  uvx --from copier==9.17.1 copier update --vcs-ref <approved-revision>
```

## Verify repo-kit

| Change | Required evidence |
| --- | --- |
| Root | `make ci-check` passes the skill source, unit test and Python format/lint gates. [Root CI](.github/workflows/root-checks.yml) |
| Copier or template | `REPO_KIT_COPIER_SMOKE=1 make test` passes on the reviewed candidate index. Use a disposable checkout when staging includes unrelated work. |
| Personal instructions | Reviewed diff and passing integrity check after authorized sync. [Instruction maintenance](docs/user-instructions.md#sync) |
| Standalone npm packages | `make check-npm-install` passes fresh, isolated installs at HEAD. [npm CI](.github/workflows/npm-install.yml) |
| Executable plugins | Shared runtime installed and checked, then `npm run check` and `npm run test:browser` in each affected plugin. Shared runtime changes require both suites. [Plugin CI](.github/workflows/workbench.yml) · [Mac browser testing](user/practices/macos-browser-testing.md) |
| MCP App starter | From a fresh `scaffold.py` output, `npm ci`, `npm run check` and `npm run test:browser` pass. [Starter CI](.github/workflows/mcp-app-skill.yml) |
| Behavior atlas starter | From a fresh `scaffold_atlas.py` output, `npm ci --ignore-scripts`, `npm run check` and `npm run build` pass. [Atlas CI](.github/workflows/behavior-atlas.yml) |

```sh
# One-time Python 3.12 check setup.
python3.12 -m venv .venv
make setup-check
```

- **Focused root checks** · `make check-source`, `make test`, `make lint`.
- **Pre-push setup** · `git config --local core.hooksPath .githooks`. Integrate with any existing custom hooks.
- **Pre-push outcome** · Each outgoing tip passes `npm ci` for each standalone npm package with a fresh cache in an isolated export. Ref deletions and allowlisted Markdown-only fast-forwards to existing branches skip the hook's installs. Hosted npm CI still runs. [Gate and allowlist](scripts/check_npm_install.py)
- **Toolchain** · Each tip's `.nvmrc` and shared exact npm pin select tools on PATH or under `${NVM_DIR:-~/.nvm}/versions/node/`. Older tips use the gate checkout's Node pin. Missing tools fail with setup instructions. Registry and authentication settings still apply.
- **Closeout** · [Finish work](skills/finish-work/SKILL.md)
