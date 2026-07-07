---
description: Rules for writing, organizing, and deprecating project documentation and glossaries.
scope: documentation rules
status: stable
last_update: 2026-07-07
---

## general
all docs (including this file) should start with a meta with: `description` (very concise), `scope`, `status` (experimental/stable/deprecated), `last_update`
- transcript/control trailer tokens such as `</content>` and `</invoke>` must never appear as standalone committed doc lines
- `docs/design/` holds **active, forward-looking** design only — specs for work
  not yet landed, plus living architecture docs still maintained as SSOT for
  their area
- **ledgers / operating records** live in `docs/reports/`, never `docs/design/`
- deprecated docs live under `docs/deprecated/`; keep their frontmatter
  `status: deprecated`, add an explicit supersession note, and link to the
  active SSOT before moving them there
- deprecated docs are **skim-only historical context**: open them only to recover
  *why* a decision was made. They are never an SSOT and never implementation
  authority; active docs may cite them only as reference-only history
- specs follow a lifecycle: a spec in `docs/design/` is forward-looking only —
  once its slice lands, promote durable contracts to their SSOT (module README /
  index / glossary / prd / backlog) and move the spec to `docs/deprecated/`.
  A spec is **never** the long-term SSOT for landed code
- completed/abandoned backlog items move out of `docs/todo/backlog.md` into
  `docs/todo/backlog-archive.md` (skim-only history; `status: stable`, it is a
  maintained ledger not a superseded doc); the live backlog carries open work only

## glossary
- meant to be read by human readers who does NOT familiar with this project
- audience is chinese; but keep the term as english
- can have some general explaination section
- should organize into semantic groups of tables
    - Term, Full form, 中文, 中文解释
    - obiously, DDD should have organzied with BC
