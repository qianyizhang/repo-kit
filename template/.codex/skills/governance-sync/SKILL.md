---
name: governance-sync
version: "1.2.0"
description: >-
  Adopt or update the shared governance kit in a repository: run Copier for
  managed files, reconcile seeded bindings and skill profiles, consolidate the
  .codex symlink layout, and restore documentation gates. Use for first adoption,
  kit updates, or promoting portable refinements upstream.
scope: governance kit adoption and sync skill
status: stable
last_update: 2026-07-15
document_class: artifact
---

# Governance kit sync

Copier propagates portable files. The agent reconciles repository-owned
bindings. Never let either side silently take the other's authority.

## Ownership model

| Kit-owned and managed on update | Repo-owned and seeded once |
|:--|:--|
| `docs/rules/*`, `scripts/check_docs.py`, `scripts/bootstrap_agents.py` | `CLAUDE.md`, `docs/index.md`, backlog and glossary |
| `ruff_base.toml`, `AGENTS.md` | `pyproject.toml` merged governance configuration |
| `governance-sync` skill core | Repository implementation and product documentation |
| `explain-layman` core, references, assets, validator, and UI metadata | `explain-layman/references/repo-bindings.md` |
| Other paths not listed in Copier `_skip_if_exists` | Exact paths listed in Copier `_skip_if_exists` |

Governance-kit releases from `v0.6.0` onward carry the portable document-class
profiles and Coordination Spine doctrine. Consumer repositories own the exact
class locations, route areas, and any declared extension classes in
`pyproject.toml`; do not encode those local bindings in the managed validator.

Portable changes go to the kit first. Repository contracts go to their binding
file. Never customize a managed skill core in a consumer.

## A. First adoption

1. **Snapshot.** Start from a clean target tree so the Copier diff is reviewable.
2. **Copy.** Run `uvx copier copy <kit-source> <target-repo>` and commit
   `.copier-answers.yml`.
3. **Merge configuration.** Merge `pyproject-doc-governance.toml` into the real
   `pyproject.toml`, then delete the dropped file.
4. **Consolidate skills.** Move authoritative skills into `.codex/skills/`, then
   run `python scripts/bootstrap_agents.py`. It must fail rather than overwrite a
   real `.agents` or `.claude/skills` directory.
5. **Fill bindings.** Complete `CLAUDE.md`, the navigator, glossary, and every
   seeded skill binding. For `explain-layman`, fill
   `references/repo-bindings.md` and validate it before using the skill.
6. **Green the gate.** Run `check_docs.py`, symlink checks, and the repository's
   full verification command.

## B. Pulling a kit update

1. Confirm the consumer and kit source are clean, or explicitly account for
   every existing change.
2. Inspect `.copier-answers.yml` to confirm the intended source and current kit
   version.
3. Run `uvx copier update` using the released kit ref.
4. Review the diff by ownership:
   - managed files should match the kit; a local conflict means the portable
     change must be promoted upstream or discarded;
   - seeded files must retain repository policy;
   - never resolve a missing local binding by copying another repository's.
5. Run binding-specific reconciliation and validation.
6. Run documentation, symlink, and full repository gates.

### Managed-skill migration

When a skill changes from “entire directory seeded” to “managed core plus local
binding,” perform this one-time migration before accepting the Copier result:

1. Diff the consumer skill against the old kit seed and extract only real local
   policy: language, paths, authority, invariants, vocabulary, source identity,
   and verification commands.
2. Put that policy in the new skipped binding file.
3. Accept the released kit copy for `SKILL.md`, general references, assets,
   scripts, and `agents/openai.yaml`.
4. Validate the binding against the kit-owned binding contract.
5. Confirm no repository name, domain object, source URL, or local verification
   command remains in the managed core.

For `explain-layman`:

```bash
python .codex/skills/explain-layman/scripts/validate_explainer.py \
  --binding .codex/skills/explain-layman/references/repo-bindings.md \
  --binding-only
```

Then validate maintained explainer HTML files and run the binding's repository
verification command.

## C. Promoting a refinement upstream

1. Classify the change:
   - reusable workflow, doctrine, template, script, validator, or visual pattern
     → patch the kit;
   - local authority, vocabulary, paths, language, or source identity → patch the
     consumer binding only.
2. Update the kit template and bump the affected skill's semver.
3. Validate the template and run a first-copy smoke test plus an update smoke
   test that proves skipped bindings survive.
4. Commit and tag the kit.
5. Run `copier update` in consumers and reconcile their bindings individually.

## Explain-layman ownership contract

Copier manages everything under `.codex/skills/explain-layman/` except
`references/repo-bindings.md`. The kit owns
`references/binding-contract.md`; a schema change must make old bindings fail
clearly. The agent then performs a semantic local migration. Copier must never
invent or overwrite repository authority.

## Pitfalls

- **Dirty consumer:** unrelated changes make ownership review unreliable. Stop
  or explicitly isolate the sync diff.
- **Managed core edited locally:** move the reusable change upstream before the
  next update; do not rely on a conflict preserving it.
- **Binding schema changed:** a skipped file will not gain new sections. Follow
  the managed contract and reconcile manually.
- **Real agent directories:** `bootstrap_agents.py` intentionally refuses to
  clobber them; consolidate first.
- **Missing `.copier-answers.yml`:** update has no baseline.
- **Narrow `code_dirs`:** path validation silently misses omitted top-level code
  directories.
