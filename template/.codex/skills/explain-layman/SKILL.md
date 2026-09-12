---
name: explain-layman
version: "1.10.0"
description: >-
  Create or revise governed stakeholder explainers as maintained pages,
  narrative slide decks, linked series, or focused interactive maps while
  preserving repository authority and provenance.
disable-model-invocation: true
scope: stakeholder explainer skill
status: stable
last_update: 2026-09-12
document_class: artifact
---

# Explain Layman

Turn one teaching job into a maintained non-technical artifact without weakening
repository contracts. Use `show-me` for a compact conversational visual; use
this explicit skill when the output is a governed stakeholder artifact.

An agent may suggest this mode but must not create or revise an explainer unless
the user asks for it.

## Ownership

- The governance kit owns the managed workflow, general references, assets,
  validator, and UI metadata.
- The repository owns `references/repo-bindings.md`: audience, authority files,
  invariants, vocabulary, output paths, source identity, and verification.
- Repository SSOTs own meaning. The agent owns narrative judgment, and
  `scripts/validate_explainer.py` checks mechanics rather than domain truth.

## 1. Validate the binding

Read `references/repo-bindings.md` completely, then run:

```bash
python .codex/skills/explain-layman/scripts/validate_explainer.py \
  --binding .codex/skills/explain-layman/references/repo-bindings.md \
  --binding-only
```

Stop if the binding is missing, outdated, or contains placeholders. Reconcile it
through `references/binding-contract.md`; never invent local policy.

## 2. Ground the teaching job

State the practical question readers should answer afterward. Follow the binding
to the authorities that support the topic and the glossary entries used. Read
other areas only when a claim or boundary depends on them.

Read `references/style-guide.md` for new or substantially revised narratives.
Use `references/artifact-shapes.md` when choosing or changing the format; for a
focused edit, use the existing artifact and only the relevant reference sections.
Carry forward the applicable authority, provenance, and release boundaries.

If the topic materially depends on a cross-cutting core-model relationship, name
it. Otherwise teach from the owning SSOTs without inventing model ceremony.

## 3. Choose the artifact

When choosing or changing the format, use `references/artifact-shapes.md`:

- **Page** for lookup, one object, one role split, or one stable process.
- **Slides** for a cumulative argument that depends on sequence.
- **Series** for independently useful teaching jobs with explicit handoffs.
- **Interactive map** when exploration materially clarifies one relationship.

For a large structural change, compare variants when the user requests a choice
or an unresolved information-design decision materially affects the teaching job.
Reuse a settled format choice and proceed through polishing and verification.

## 4. Write and visualize

- Lead with the answer, then earn the detail.
- Teach governing concepts and relationships before stack, files, or milestones.
  Use canonical names, explicit actors, short sentences, and clear conditions.
- Show the relevant landscape before highlighting the project's chosen scope;
  label omissions.
- When replacing a baseline, explain what it accomplished, why it was initially
  sufficient, and what now fails without making it a strawman.
- Use one visual spine once. Later sections must add a different lens.
- Distinguish parallel capability lanes from vertical integration and coverage
  growth from capability growth.
- For a series, state what each artifact settles, what remains, and why the next
  one follows.
- Adapt matching assets and remove unused placeholder sections.

Every artifact must link to the authorities it explains; it is not a second
contract or glossary.

## 5. Terminology and tooltips

Use reader language first and keep canonical names visible where traceability
matters. On the first meaningful use of a specialized or repository-canonical
term:

- use the glossary wording;
- add a keyboard-focusable tooltip;
- explain what it means and why it appears here;
- keep essential meaning visible outside the tooltip.

Never introduce policy through tooltip text.

## 6. Provenance and navigation

- Stamp substantive artifacts with
  `explain-layman@<version> · profile=<profile>@<profile_version> · agent=<id> · effort=<level> · <date>`.
- Use the binding's output directory, index, source URL, footer, and language.
- Align filename, `<title>`, H1, and footer title.
- Update the navigator only when its area or concept routing contract requires
  it; do not enumerate every artifact. Add accepted durable vocabulary to the
  glossary in the same change.

## 7. Verify

Run the validator on every changed HTML artifact:

```bash
python .codex/skills/explain-layman/scripts/validate_explainer.py \
  --binding .codex/skills/explain-layman/references/repo-bindings.md \
  path/to/explainer.html
```

Inspect the affected desktop and narrow layouts. For changed slide behavior,
verify direct hash navigation, keyboard controls, no-JS reading, print, and reduced
motion as applicable. Run the binding's artifact completion command and any
additional checks required by the changed surface. A standalone artifact edit
does not by itself require unrelated application tests; existing required gates
remain in force.

Do not claim visual inspection when only structural checks were possible. Record
the limitation and leave that work open.
