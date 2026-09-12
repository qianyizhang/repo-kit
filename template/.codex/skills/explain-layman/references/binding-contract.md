# Repository binding contract

`repo-bindings.md` is the only consumer-owned part of `explain-layman`. Copier
seeds it once and never overwrites it. The portable skill and validator are
kit-owned.

## Required metadata

The binding begins with simple YAML frontmatter containing:

- `binding_schema`: contract version; currently `"1"`;
- `profile`: stable repository profile name;
- `profile_version`: semver bumped when local explainer behavior changes;
- `artifact_language`: default stakeholder artifact language;
- `output_dir`: default maintained-artifact directory;
- `index_file`: repository navigator to update;
- `canonical_repo_url`: source URL used in freshness notices;
- `verification_command`: completion command for maintained explainer artifacts;
- `agent_instructions`: repository agent-instruction SSOT.

## Required sections

- `## Audience and artifact defaults`
- `## Authority and grounding`
- `## Non-negotiable boundaries`
- `## Vocabulary and tooltips`
- `## Navigation and provenance`
- `## Verification`

Use concrete local paths and contracts. Remove all `FILL_IN` markers before the
skill is used. Scope `verification_command` to artifacts; name additional checks
for changed application behavior or required release gates in `## Verification`.
Do not restate general visual or editorial craft here.

When this contract adds a required field or section, bump `binding_schema` in
the portable validator. `governance-sync` must then reconcile each skipped local
binding manually; Copier must not manufacture local policy.
