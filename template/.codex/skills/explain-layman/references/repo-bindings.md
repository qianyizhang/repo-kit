---
binding_schema: "1"
profile: "repo_kit"
profile_version: "1.0.0"
artifact_language: "en"
output_dir: "docs/background"
index_file: "README.md"
canonical_repo_url: "https://github.com/qianyizhang/repo-kit"
verification_command: "python .codex/skills/explain-layman/scripts/validate_explainer.py --binding .codex/skills/explain-layman/references/repo-bindings.md --binding-only"
agent_instructions: "CLAUDE.md"
---

# repo-kit explainer bindings

## Audience and artifact defaults

Primary audience includes engineers, kit maintainers, and downstream adopters.
Explainers should default to English and use concise, diagram-backed structural
overviews.

## Authority and grounding

Ground explainers in `CLAUDE.md`, `docs/models.md`, and `docs/adr/`. The core
model owns cross-cutting product concepts (Candidate, Portable product, Consumer
binding, Campaign).

## Non-negotiable boundaries

1. `template/` is the portable product; changes require explicit promotion.
2. Downstream bindings, vocabularies, and verification commands stay local.
3. Copier ownership boundaries are path-based and governed by `copier.yml`.

## Vocabulary and tooltips

Use canonical terms: Candidate, Portable product, Consumer binding, Campaign,
Frontier, Lock, Handoff. Avoid conflating candidate evidence with authority.

## Navigation and provenance

Artifacts must include an accessible title, responsive container, provenance
stamp in metadata, and canonical repository URL in the footer.

## Verification

Run `python .codex/skills/explain-layman/scripts/validate_explainer.py --binding .codex/skills/explain-layman/references/repo-bindings.md --binding-only`
and inspect rendered HTML on standard desktop and mobile viewports.
