---
description: Repo-governance doctrine — the doctrine/binding split, SSOT & navigator-index pattern, glossary discipline, agent-toolchain symlink layout, and the mechanical-enforcement inventory.
scope: repo governance rules
status: stable
last_update: 2026-07-16
document_class: coordination
---

# Governance rules

The meta-rules that keep a multi-doc, multi-toolchain repo honest. Everything
here is **portable doctrine** — nothing in this file names a domain concept.
Project-specific content (the governing invariant, module graph, glossary
entries, command list) is a **binding** and lives in `CLAUDE.md`.

## doctrine vs binding

The split that makes governance reusable across repos:

- **Doctrine** — a practice that would hold in any repo of this shape — lives
  in `docs/rules/*.md`, one body per topic (`doc.md`, `skill.md`, `testing.md`,
  `python.md`, this file).
- **Binding** — what is true of *this* repo (its invariant, architecture,
  commands, exemplar files, authority list) — lives in `CLAUDE.md`, which keeps
  only bindings plus one-line pointers into doctrine.
- A refinement discovered while working goes to its doctrine file when it is
  project-agnostic, to `CLAUDE.md` when it is a binding. Restating doctrine
  inside `CLAUDE.md` (beyond a pointer and the few must-internalize lines) is
  drift.

## SSOT and the navigator index

- **One meaning lives once.** Every topic has exactly one authoritative doc
  (its SSOT); everything else points at it. Duplicated prose is a future
  contradiction.
- `docs/index.md` is a **thin navigator, not an authority**: it routes areas and
  the **structural authority docs** (product spine, ADRs, rules, glossary, design,
  module contracts) with an explicit **Authority & precedence** order for overlap.
  It does **not** enumerate every file — operating records (reports, work-items,
  generated outputs) are reached by directory route + disposable Human View, not
  per-file rows. When the index and a target disagree, the target wins — fix the index.
- Docs live on an abstraction ladder (charter → product → plan → architecture →
  design → code) plus cross-cutting layers (reference/glossary, operating
  record/reports, playbooks/skills, archive/deprecated). A new **structural
  authority doc** (rule/design/glossary and the like) states its rung and gets an
  index row in the same change; a report, work-item, or generated output does not
  — its directory route already covers it.
- Lifecycle (frontmatter, deprecation contract, spec promotion, backlog
  hygiene) is owned by `docs/rules/doc.md`.

## glossary / ubiquitous language

- `docs/glossary/` is the ubiquitous-language SSOT. Names in code (classes,
  tables, fields, API paths) must match it.
- A change introducing a new domain term updates the glossary **in the same
  change** — a term that exists only in code or only in chat is not yet part of
  the language.
- Glossary format and audience rules live in `docs/rules/doc.md`.

## agent toolchains & symlink layout

A repo worked by multiple agent toolchains — Claude Code (`CLAUDE.md`), Codex,
and other AGENTS.md-convention agents — keeps one source of truth by sharing
instructions and skills **by symlink, not copy**:

```text
CLAUDE.md                 # SSOT for all agents (real file)
AGENTS.md                 # thin pointer → "follow CLAUDE.md"
.codex/                   # canonical home for shared agent assets (real dir)
  ├── agents/             #   subagent definitions
  └── skills/             #   shared skills
.agents   ->  .codex      # symlink: AGENTS.md-convention discovery path
.claude/
  ├── settings.json       # Claude Code config (real file)
  └── skills  ->  ../.codex/skills   # symlink: Claude Code skill discovery
```

- INVARIANT: `.codex/` holds the real assets; `.agents` and `.claude/skills`
  are **relative symlinks into it**. Edit a skill once under `.codex/skills/`
  and every toolchain sees the change; never duplicate a skill per toolchain.
- Never delete or `rm -rf` through a symlinked path expecting to remove only
  the link — resolve the target first. A symlink-unaware delete destroys the
  canonical assets.
- The expected link map is declared in `pyproject.toml [tool.doc_governance.symlinks]`
  and verified mechanically (see below), so a broken or copied-instead-of-linked
  layout fails lint instead of silently drifting. `scripts/bootstrap_agents.py`
  creates or repairs the declared layout; it fails closed on real directories,
  so consolidating duplicated copies stays a judgment step.

## mechanical enforcement

Prose rules rot; every rule that *can* be checked mechanically is, via
`make lint` + pre-commit. The inventory:

- `scripts/check_docs.py` — doc governance. Reads its repo bindings from
  `pyproject.toml [tool.doc_governance]` (the script itself stays portable):
  frontmatter contract, status↔folder coupling, forbidden generated-trailer
  tokens, local-link and backticked-repo-path validity in authority docs,
  navigator-index coverage of rule/design/glossary docs, skill-manifest semver,
  durable backlog-item identity/lifecycle/lineage/ledger structure, and the
  symlink layout above.
- `import-linter` — architecture rules as import contracts
  (`[tool.importlinter]`); a broken contract is a design signal, not a hurdle.
- `ruff` — style baseline; doctrine defaults in `ruff_base.toml`, repo
  exceptions in `pyproject.toml`.

A new prose rule should ask "can `check_docs.py` own this?" before settling for
vigilance. The semantic layer that cannot be mechanized (contradictions, stale
terms, capture of emergent knowledge) belongs to a hygiene skill run
periodically (`doc-hygiene-audit`).

## context hygiene

Portable coordination of agent **context windows** (not product releases):

- Keep DECIDE / fit / slice packaging in **one continuous window** until a
  durable handoff packet exists (work item + plan paths, stop condition, mode).
- Prefer a **fresh window per IMPLEMENT work item**, starting from the item and
  its Implementation Ledger — not chat memory.
- Near degraded context (long thread, compaction pressure, tool switch): write a
  **session handoff** before continuing; do not push on a foggy window.
- Parallel writers use a **claim ledger**; single-writer cuts use session handoff
  only (see the `handoff` skill when present).

## housekeeping loop

After a task:

- Revisit the agent-instruction SSOT (`CLAUDE.md`) — doctrine refinements go to
  `docs/rules/`, bindings to `CLAUDE.md`; when unsure which doc is the SSOT, ask.
- Unfinished/deferred work goes to the backlog, not into silence.
- Every new doc carries frontmatter; a new **structural authority doc** also gets
  an index row (operating records are directory-routed, not indexed per file).
- After grinding with a project skill, propose improvements to it
  (`docs/rules/skill.md` field-notes loop).
- **Kit propagation.** This doctrine corpus is consumed from a shared
  governance kit (a copier template; the consumer's `.copier-answers.yml`
  names the source). A project-agnostic refinement is promoted upstream —
  patch the kit, tag it, `copier update` the consumers (`governance-sync`
  skill) — never left to drift in one repo. Binding changes stay local.
  Kit-owned files (`docs/rules/*`, `scripts/check_docs.py`,
  `scripts/bootstrap_agents.py`, `ruff_base.toml`, `AGENTS.md`, and managed
  skill cores) are overwritten on update. Seeded files (`CLAUDE.md`, glossary,
  backlog, seeded skills, and explicit repository-binding files) are repo-owned
  after first copy. A managed skill may therefore keep portable workflow in its
  kit-owned core while routing local authority to one skipped binding file; the
  Copier `_skip_if_exists` list is the ownership boundary.
