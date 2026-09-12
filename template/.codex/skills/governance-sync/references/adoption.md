# First adoption

1. Start from a clean target so the Copier diff is attributable.
2. Run:

   ```bash
   UV_CACHE_DIR=.cache/uv UV_TOOL_DIR=.cache/uv-tools \
     uvx --from copier==9.17.1 copier copy <kit-source> <target-repo>
   ```

3. Merge `pyproject-doc-governance.toml` into `pyproject.toml`, then delete the
   fragment.
4. Consolidate real agent assets under `.codex/skills/`; run
   `python scripts/bootstrap_agents.py`. It must not overwrite real discovery
   directories.
5. Fill `CLAUDE.md`, `docs/index.md`, the glossary, and required binding files.
   Validate the `explain-layman` binding before using that skill.
6. Run documentation and symlink checks, then the gates required by the new
   build or governance integration. Follow `docs/rules/testing.md` for scope.
