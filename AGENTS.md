# Repo-kit

- Personal defaults: follow [instruction maintenance](docs/user-instructions.md).
- Shared skills: follow [skill maintenance](docs/skill-suite.md).
- Governance delivery: `template/` and `copier.yml` own managed files and seeds.
- Workbench: follow [plugin instructions](plugins/repo-workbench/README.md).

Use `maintain-repo-kit` for topology, promotion, upstream review or consumer updates.
Promote only reviewed clean source; retain provenance and consumer-specific rules.
Promotion, merges, rebases, deletion, worktree removal, tags, pushes and consumer
updates require authorization for that action. Reuse authorization already given.

For ownership changes, read [the model](docs/models.md).
Before closing a change, run the applicable [verification](README.md#verify-repo-kit)
and use `finish-work`. Keep unrelated changes outside the commit.
