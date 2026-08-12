# External upstream registry

Review an upstream only during an explicit maintenance survey. A URL is an idea
source, never an authority to overwrite repo-kit.

## mattpocock/skills

- Source: `https://github.com/mattpocock/skills.git`
- Branch: `main`
- Local mappings: `grilling`, `grill-with-docs`, `handoff`, skill-authoring
  vocabulary
- Attribution: preserve the existing `mattpocock/skills` note where adapted
  vocabulary or workflow remains.
- Compare: behavior, invocation boundary, completion gate, fact/decision split,
  and context cost. Do not mirror packaging or tool-specific metadata.

### Review procedure

1. Resolve `refs/heads/main` and record its commit.
2. Shallow-clone or fetch into an OS temporary directory.
3. Read the mapped `SKILL.md` files and the changelog entries since the prior
   reviewed commit when one is recorded in Git history.
4. Compare against repo-kit's template skills and doctrine.
5. Produce `adopt`, `adapt`, `watch`, `reject`, or `already-covered` findings.
6. Use `grilling` for any proposed change to a local workflow default.

### Last reviewed snapshot

- Date: 2026-08-12
- Commit: `84fdeffd12f2ee307994d1eb6feb48173b6e0502`
- Findings:
  - The latest `grill-me` commit changes public documentation wording only;
    there is no local behavior delta to adopt.
  - Frontier rounds, fact/decision separation, and an explicit confirmation
    gate are already covered by repo-kit's `grilling` workflow.
  - Upstream makes frontier batching the default. The user adopted that default
    for repo-kit on 2026-08-12; dependent questions remain in later rounds and
    serial rounds remain an explicit user option.
  - Upstream `resolving-merge-conflicts` says never abort. Reject that rule for
    repo-kit governance: unresolved authority or unsafe conflict state must be
    allowed to stop without inventing a resolution.
