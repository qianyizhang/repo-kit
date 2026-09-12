# Kit update

1. Require a clean consumer and confirm the source plus recorded `_commit` in
   `.copier-answers.yml`.
2. Run:

   ```bash
   UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools \
     uvx --from copier==9.17.1 copier update
   ```

3. Review by ownership: managed files should match the kit; seeded files must
   retain local meaning. Never fill a missing binding from another consumer.
4. Compare every `_skip_if_exists` path with its seed at the recorded baseline,
   even when Copier reports no conflict. Merge portable structure while
   preserving local models, routes, schema extensions, vocabulary, paths, and
   commands.
5. Reconcile the pyproject fragment if Copier recreates it, then delete it.
6. Run documentation and symlink checks; select other repository gates by the
   changed behavior and integration under `docs/rules/testing.md`.

When doctrine changes a lifecycle or closeout default, reconcile the seeded
backlog, navigator, and local evidence/retention bindings explicitly. Managed-file
parity is not enough: check that local instructions and machine readers still
support the resulting lifecycle. Propagating retention rules does not itself
authorize deleting consumer records; apply them within the user's cleanup scope.

An `_skip_if_exists` change is a migration, not a routine update. Before
accepting a newly managed path, compare it with the old seed, extract local
authority to its proper binding or local skill, and verify the managed result.

For the explainer binding:

```bash
python .codex/skills/explain-layman/scripts/validate_explainer.py \
  --binding .codex/skills/explain-layman/references/repo-bindings.md \
  --binding-only
```
