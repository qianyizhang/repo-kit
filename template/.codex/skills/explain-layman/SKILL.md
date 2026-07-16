---
name: explain-layman
version: "1.8.2"
description: >-
  Create or revise plain-language stakeholder explainers as standalone pages,
  narrative slide decks, linked series, or focused interactive maps while
  preserving repository authority and provenance.
disable-model-invocation: true
scope: stakeholder explainer skill
status: stable
last_update: 2026-07-16
document_class: artifact
---

# Explain Layman

Turn one teaching job into a non-technical stakeholder artifact without
weakening the repository's contracts.

This is an explicit interaction mode. An agent may suggest it, but must not
start producing or revising an explainer merely because plain-language
communication could be useful.

## Ownership and role split

- The governance kit owns this workflow, its general references, templates,
  validator, and UI metadata. Promote portable improvements upstream; do not
  customize those files in a consumer repository.
- The consumer owns `references/repo-bindings.md`. It names the local audience,
  authority files, invariants, vocabulary, output locations, source identity,
  and verification command.
- The agent judges narrative structure, examples, and honest omission. Repository
  SSOTs own meaning. `scripts/validate_explainer.py` gates mechanical contracts;
  it does not judge clinical or domain truth.

## 1. Load and validate the local binding

Read `references/repo-bindings.md` completely. Then run:

```bash
python .codex/skills/explain-layman/scripts/validate_explainer.py \
  --binding .codex/skills/explain-layman/references/repo-bindings.md \
  --binding-only
```

Stop if the binding is missing, outdated, or contains placeholders. Follow
`references/binding-contract.md` when reconciling it; never invent local policy.

## 2. Ground the teaching job

Read, in order:

1. the agent-instruction SSOT named by the binding;
2. the repository navigator and topic SSOTs named by the binding;
3. the local glossary and avoid-list;
4. `references/style-guide.md`;
5. `references/artifact-shapes.md`;
6. one nearby maintained explainer, if available.

Restate the artifact's single **teaching job**: the practical question readers
should be able to answer afterward. A teaching job may require several related
boundaries; do not force a landscape explanation into one narrow definition.

Before writing, list the relevant authority, safety, provenance, and release
boundaries from the binding. Preserve all of them in the artifact.

## 3. Choose the artifact shape

Use the decision table in `references/artifact-shapes.md`:

- **Page** for lookup, one object, one role split, or one stable process.
- **Slides** for a cumulative argument whose meaning depends on sequence.
- **Series** for several independently useful teaching jobs with explicit
  handoffs.
- **Interactive map** for one relationship that is materially clearer through
  exploration.

For a large structural change with genuine alternatives, build two or three
throwaway variants and let the user choose before polishing. Delete previews
after the choice is incorporated.

## 4. Write and visualize

- Lead with the answer, then earn the detail. Use operational language rather
  than marketing or implementation narration.
- Show the whole relevant landscape before highlighting the project's chosen
  scope. Label omissions and uncovered areas explicitly.
- When replacing a baseline, state what it accomplished, where its authority
  sat, why it was initially sufficient, and what fails at scale. Do not create a
  strawman.
- Use one visual spine once. Other sections should add a different lens, not
  repeat the same sequence.
- For implementation explainers, distinguish parallel capability lanes from
  vertical integration and distinguish coverage growth from capability growth.
- For a series, include both a numbered reading-order strip and a narrative
  handoff: what this artifact settled, what remains unanswered, and why the next
  artifact follows.
- Use the dependency-free assets as starting points when they match the chosen
  shape. Adapt them; do not preserve unused placeholder sections.

## 5. Run the terminology and tooltip pass

Use reader-language first. Keep canonical names visible where traceability
matters. For the first meaningful use of every clinical, scientific,
regulatory, coding, or repository-canonical term:

- use the glossary's canonical wording;
- add a keyboard-focusable tooltip;
- explain both what the term means and why it appears in that context;
- keep essential meaning visible outside the tooltip.

Never use tooltip text to introduce policy absent from an authority source.

## 6. Preserve provenance and navigation

- Stamp substantive artifacts with
  `explain-layman@<version> · profile=<profile>@<profile_version> · agent=<id> · effort=<level> · <date>`.
- Use the binding's output directory, index file, canonical source URL, footer
  wording, and artifact language.
- Align filename, `<title>`, H1, and footer title.
- Update the repository navigator for a maintained artifact. Update the glossary
  in the same change when introducing durable vocabulary.

## 7. Verify

Run the deterministic validator on every changed HTML artifact:

```bash
python .codex/skills/explain-layman/scripts/validate_explainer.py \
  --binding .codex/skills/explain-layman/references/repo-bindings.md \
  path/to/explainer.html
```

Then visually inspect desktop and narrow layouts. For slides, also verify direct
hash navigation, keyboard controls, no-JS reading, print output, and reduced
motion. Finally run the repository verification command from the binding; the
local repository policy, not this portable skill, decides the required gate.

Do not claim visual inspection when the environment only allowed structural
checks. Record the limitation and leave the corresponding work open.
