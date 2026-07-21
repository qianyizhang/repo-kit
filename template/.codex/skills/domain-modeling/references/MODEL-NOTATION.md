# Core-Models Layer & Model Notation

Portable doctrine for the optional `docs/models.md` orientation layer and the
small notation its parts are written in. Adopt when a repo has enough ADRs that
readers reverse-engineer the underlying models from them; skip it otherwise.
This file is the portable pattern — the specific symbol set below is a
recommended default a repo may replace with its own reference or DSL.

## The core-models layer

A repo's ADRs are rarely independent: they are point commitments serving a small
number of underlying models. `docs/models.md` names those models directly so a
newcomer (human or agent) can read a few models and *predict* the ADRs, instead
of reverse-engineering the models from twenty-plus decisions.

- **Authority.** Orientation, not decision authority. It sits below `CLAUDE.md`
  and above the ADRs in reading order. When it appears to conflict with an ADR on
  a specific decision, the ADR wins and `models.md` is fixed to match.
- **Scope.** Name the few system-level models and their parts. Attributes stamped
  onto artifacts by those models (citation, provenance, versioning, usage scope,
  maturity) are not themselves separate models — do not inflate the count.
- **Earned, not speculative.** Stand it up only when the ADR count makes the
  models hard to see. A three-ADR repo does not need it.

## Coordinates

Each model part carries a **frozen coordinate** — a short stable identifier
(e.g. `m1.junction`, `m2.stamps`). Coordinates are an interface, not prose:

- Every feature or contract proposal names the coordinates it instantiates or
  alters (e.g. "touches `m1.junction` — must stay side-effect-free"). A proposal
  claiming to be model-neutral defends that claim rather than omitting the link.
- Adding, renaming, or retiring a coordinate is an **ADR-level change** — the same
  bar as changing a decision.
- ADRs cite the coordinate they serve via the `Serves:` note in
  `ADR-FORMAT.md`. Adopt a cutover point (e.g. "from ADR-00NN onward") rather than
  retro-editing historical ADRs.

## Notation (recommended default — swappable per repo)

Model parts are written in a small symbolic notation: discrete items with typed
relationships — more than a mind map, less than prose. A repo picks **one** such
notation and freezes it; the set below is a sound default, but a repo may adopt
its own reference or a purpose-built DSL. Whatever the choice, the symbol set is
frozen within the repo: admitting a new symbol requires ≥2 model parts that need
it and an ADR — the same bar as adding a coordinate.

| Form | Meaning |
| --- | --- |
| `id : kind [tags]` | one model part; `kind` is e.g. `chain` / `fn` / `law`; tags are invariants |
| `A -> B` | data flow — a plain handoff |
| `A => B` | authority transfer — the hop changes who may produce and what the artifact is licensed for |
| `A \|> G` | fail-closed validation against pinned gate `G` |
| `A ~> B` | representation-only rendering — `B` carries no authority |
| `X!` | frozen / immutable artifact |
| `X~` | ephemeral, recomputed on demand |
| `X*` | collection / many |
| `+` / `-` / `±` | diff marks — a proposed model change rendered on the current parts |
| `?` | open question pinned to an item or edge |

A proposal that alters a model expresses the change as a notation diff
(`+` / `-` / `±` on the touched parts) before any prose. The notation is a
reading/writing convention, not a parsed format, unless a repo deliberately
tools it.

### Rendering heuristic

When rendering a part into a diagram, pick the container by dominant edge type:
`->` chains → hierarchical DAG; `=>` transfers → sequence diagram; packaging /
fan-out → fan-in; full-corpus browsing → card lattice.

## Repo binding

This file is portable doctrine (the pattern and the default grammar). A repo's
own `docs/models.md` is the binding: its model corpus, its coordinates, and — if
it diverges from the default — its chosen notation or DSL. Keep the binding in
`docs/models.md`; keep portable refinements here and promote them upstream.
