# External upstream registry

Upstreams provide Candidates, never authority. For each review, fetch into a
temporary directory, record the commit, compare behavior, and classify findings
as `adopt`, `adapt`, `watch`, `reject`, or `already-covered`.

## Personal practice review — 2026-10-22

- `cursor/plugins/pstack` at `d1453c11d1dde9714d4c313c97d3a68432265c7f`
  (Lauren Tan, MIT, 0.15.29): **adapt** selected type/boundary,
  structural-learning and experience/verification concepts into `user/` and its
  maintenance process. Full orchestration remains outside adoption.
- `mattpocock/skills` at `5beb35b040e3de97e54fa9e386d7e42d15c295c2`:
  **already-covered**; all 18 files in the six selected directories match the
  existing pinned snapshot. No refresh or additional skills were installed.
- Review depth, concrete TypeScript counterexamples and primary platform sources
  are recorded in the [review summary](../../../../docs/reviews/README.md).
  Future additions follow [user instruction maintenance](../../../../docs/user-instructions.md).

## Shared suite adoption — 2026-10-14

Adopted six unchanged Matt skills from `49dd158d1076134a641b33efb035946536778336`:
`retro`, `improve-codebase-architecture`, `codebase-design`, `domain-modeling`,
`grilling`, and `writing-for-agents`. Complete directories and MIT license are
pinned in root `skills-lock.json`; root `skills/` is the shared product.
Review depth: selected skill bodies, dependencies, references and invocation
metadata. This is not adoption of Matt's tracker or ticket orchestration suite.
Local authority preserves accepted decisions and resolves document destinations.
See [suite maintenance](../../../../docs/skill-suite.md).

## Bounded refresh — 2026-09-21

Reviewed mapped behaviors in fresh temporary Git snapshots; earlier adaptation
provenance below remains retained. This was not an audit of every upstream skill
or a refresh of the web essays.

| Source | Reviewed commit | Disposition |
| --- | --- | --- |
| `mattpocock/skills` | `c55ee46073ed923f86ce59a5eb3b6d895095d1b7` | `already-covered`: decision frontiers, task completion, and conditional references. Preserve local decision locks and authorized continuation. |
| `AminBlg/SimpleEnglish` | `79b590fc8596523d92c26b1ea7e33236606ef069` | `adapt`: literal-protection and symlink-alias test scenarios for authoring/bootstrap defects. Implement local scanners and path checks; do not copy the upstream parser or global vocabulary policy. |
| `humanlayer/skills` | `ca7c8088db69e315a8b2deea43820270457f8f3c` | `already-covered`: smallest-useful visual grammar. Preserve local evidence labels, artifact intent, and environment-supported rendering. |

Local owners: `template/scripts/check_authoring.py`,
`template/scripts/bootstrap_agents.py`, and their regression tests. The defects
were independently reproduced locally; upstream scenarios inform coverage, not
replacement implementations or new skill surfaces.

## mattpocock/skills

- Source: `https://github.com/mattpocock/skills.git`
- Branch: `main`
- Local mappings: `grilling`, `grill-with-docs`, `handoff`, Campaign model,
  skill vocabulary
- Attribution: preserve the existing `mattpocock/skills` note where adapted
  vocabulary or workflow remains.

### Last reviewed snapshot

- Date: 2026-08-17
- Commit: `068b6e0c62393147daf03530149cdce209c93da8`
- Findings:
  - `adapt`: `wayfinder` destination, fog, frontier, and maps-as-indexes into a
    bounded Campaign that links existing authorities.
  - `already-covered`: frontier batching, fact/decision separation, and
    confirmation gates.
  - `watch`: future `wayfinder` behavior that closes a demonstrated local gap.
  - `reject`: a new skill or tracking layer and its one-decision-per-session
    rule; existing work and decision records already own that information.
  - `reject`: `resolving-merge-conflicts`' never-abort rule; unsafe or ambiguous
    authority must be allowed to stop.

## AminBlg/SimpleEnglish

- Source: `https://github.com/AminBlg/SimpleEnglish.git`
- Branch: `main`
- Local mappings: `docs/rules/authoring.md`, `scripts/check_authoring.py`,
  `explain-layman`
- Attribution: retain this commit and the authoring-doctrine note while adapted
  controlled-language ideas remain.

### Last reviewed snapshot

- Date: 2026-08-17
- Commit: `59bf6702197a5aadc96d197ea17f290d8d50dcd3`
- Findings:
  - `adapt`: one name per concept, explicit actors, simple assertions, ordered
    conditions, and protection of literals.
  - `reject`: its fixed dictionary, compliance claim, and a new skill surface;
    local glossaries, doctrine, checker, and explainer already own the behavior.

## Geoffrey Litt — Understanding is the new bottleneck

- Source: `https://www.geoffreylitt.com/2026/07/02/understanding-is-the-new-bottleneck`
- Reviewed: 2026-08-17
- Local mappings: `show-me`, `explain-layman`
- Findings:
  - `adapt`: background-first explanations, model-first change narratives, and
    interactive micro-worlds where they improve participation.
  - `reject`: a prescribed artifact format or another explainer skill; media are
    replaceable projections.

## humanlayer/skills

- Source: `https://github.com/humanlayer/skills.git`
- Branch: `main`
- Local mappings: `show-me`
- Attribution: keep the upstream MIT license with the managed skill and retain
  the reviewed commit in `SKILL.md`.

### Last reviewed snapshot

- Date: 2026-08-13
- Commit: `4d8d644ca747517973f58d7953f58d7cd07520cd`
- Findings:
  - `adopt`: the smallest-useful-visual grammar.
  - `adapt`: platform-specific opening to active-environment tools.
  - Keep source labels, mark hypothetical shapes, and require user intent before
    creating a durable artifact.


## OpenAI — Rethinking skills and prompts for GPT-6 Astra

- Source: https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra
- Published: 2026-09-11; reviewed: 2026-09-12 (web article, no Git revision).
- Local evidence: Qi `1629c95` supplied the committed concise `next-slice` and
  `show-gap` candidates; kit `c60fb19` already contains decision-acceptance and
  per-decision ADR corrections absent from Qi.
- `adapt`: task-sized completion, conditional reading, scoped verification,
  mode-specific handoff/practice/sync references, and discriminating descriptions.
- `already-covered`: scoped authority, evidence retention, explicit-only interaction
  modes, and the kit's acceptance/ADR corrections.
- Retained: authority and permission boundaries, frozen experiment evidence,
  deterministic checks for real contracts, and mandatory release gates. Shared
  skills remain suitable for multiple models; no model-specific behavior switch.
- Validation: structural and Copier checks plus scenario walkthroughs can assess
  preservation and routing. They do not establish model performance improvements.
