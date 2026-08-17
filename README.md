# repo-kit

A [Copier](https://copier.readthedocs.io/) product for portable repository
governance. `template/` is the product authority; the root
[`CLAUDE.md`](CLAUDE.md) governs maintenance of this repository only.

The [core model](docs/models.md) and [decision records](docs/adr/) explain how
Candidates, Campaigns, the portable product, and consumer bindings relate.

## Ownership contract

Kit-managed files are replaced by `copier update`: portable doctrine, checks,
agent bootstrap, and every shared core under `template/.codex/skills/`.

True seeds and bindings stay consumer-owned: the consumer constitution, index,
backlog, glossary, local configuration merge, and explainer binding. Copier
distributes shared behavior; it does not own local meaning.

Each consumer records its source revision in `.copier-answers.yml`. Reconcile
updates from that `_commit`. Tags are preferred release checkpoints, not the
only valid source revisions.

## Apply or update

Use the managed `governance-sync` skill for semantic reconciliation around the
raw Copier operation.

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
