# repo-kit

Shared agent skills and a separate [Copier](https://copier.readthedocs.io/)
governance template. `skills/` owns the eight-skill bundle; `template/` owns
portable governance. Root [CLAUDE.md](CLAUDE.md) governs maintenance here.

## Shared skills

Six unchanged Matt Pocock skills plus concise `next-slice` and `show-me` are
installed once for your user account. From this repository:

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

Kit-managed files are replaced by `copier update`: portable doctrine, checks,
and agent bootstrap. Shared skills have separate delivery.

True seeds and bindings stay consumer-owned: the consumer constitution, index,
backlog, glossary, local configuration merge. Copier
distributes shared behavior; it does not own local meaning.

Each consumer records its source revision in `.copier-answers.yml`. Reconcile
updates from that `_commit`. Tags are preferred release checkpoints, not the
only valid source revisions.

## Apply or update

Inspect the consumer baseline and reconcile local bindings around the raw
Copier operation.

```bash
# first adoption
UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools \
  uvx --from copier==9.17.1 copier copy ~/pkgs/repo-kit <target-repo>

# update from the recorded source
cd <target-repo>
UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools \
  uvx --from copier==9.17.1 copier update
```

Review preserved bindings and run the consumer's checks before accepting an
update.

## Verify repo-kit

Run the pinned unit, Copier-smoke, and Ruff commands in
[`CLAUDE.md`](CLAUDE.md#verification).
