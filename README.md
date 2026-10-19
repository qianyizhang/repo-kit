# repo-kit

Shared agent skills and a separate [Copier](https://copier.readthedocs.io/)
governance template. `skills/` owns the nine-skill bundle; `template/` owns
portable governance. Root [CLAUDE.md](CLAUDE.md) governs maintenance here.

## Shared skills

Six unchanged Matt Pocock skills plus `next-slice`, `show-me`, and
`simplify-repository` are installed once for your user account. From this repository:

```sh
python3.12 scripts/skills.py diff
python3.12 scripts/skills.py sync
python3.12 scripts/skills.py check
```

See [pinning, update review, recovery and local mappings](docs/skill-suite.md).
Shared skills are no longer copied by Copier. Project-specific skills stay local.

The [core model](docs/models.md) and [decision records](docs/adr/) explain how
Candidates, Campaigns, the portable product, and consumer bindings relate.

## Ownership contract

Among paths delivered by `template/`, those outside Copier's `_skip_if_exists`
list are kit-managed: portable doctrine, checks and agent bootstrap.
`copier update` merges template changes against the recorded baseline; review conflicts and local edits before accepting the managed result.

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
update.

## Verify repo-kit

Run the pinned unit, Copier-smoke, and Ruff commands in
[`CLAUDE.md`](CLAUDE.md#verification).
