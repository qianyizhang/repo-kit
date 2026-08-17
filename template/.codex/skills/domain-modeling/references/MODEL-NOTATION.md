# Core models and optional notation

A core model names the few concepts and relationships that make several
contracts, ADRs, or implementation boundaries predictable. It is not a package
inventory, technology list, roadmap, or claim of objective completeness.

## Authority and placement

- The core model owns cross-decision concepts and relationships.
- Contracts and ADRs own cross-shard behavior and durable trade-offs.
- Code and tests own executable local behavior.
- Work records coordinate change; they do not become another authority layer.

Keep a genuinely small model in `CLAUDE.md`. Use `docs/models.md` when several
models, diagrams, examples, or stable references would make `CLAUDE.md` noisy;
leave a concise governing summary and link behind. Keep implementation detail in
its lower authority.

Name a model relationship only when it materially governs the work. A local
implementation or presentation change does not need a synthetic model binding.

## Deliberate evolution

Core models are working mental models. Change one when evidence improves the
project's cross-cutting understanding, never as a quiet side effect of feature
work.

1. Show the current and proposed concepts or relationships.
2. State the evidence and misunderstanding being corrected.
3. List affected ADRs, contracts, glossary entries, code, and tests.
4. Obtain an explicit decision lock.
5. Update the model and directly affected lower authorities coherently.

If an ADR and the model disagree, determine which understanding changed. Update
the model explicitly or supersede the ADR; do not silently edit whichever file
is easier.

## Optional stable handles

Use short handles such as `authority.promotion` only when repeated ADRs or
proposals must cite individual relationships.

- Keep a handle stable while its meaning is stable.
- Rename, split, or retire it with the model change.
- Require an ADR only when the semantic change also meets the ADR criteria.

## Optional notation

Prefer concise sentences and the smallest useful graph. If repeated work
benefits from symbols, document a small set in `docs/models.md`. This default is
available without being mandatory:

| Form | Meaning |
| --- | --- |
| `A -> B` | data or ordinary work flow |
| `A => B` | explicit authority transfer |
| `A \|> G` | validation against gate `G` |
| `A ~> B` | representation-only projection |
| `X!` | deliberately frozen artifact |
| `X~` | ephemeral, recomputed view |
| `+` / `-` / `±` | proposed addition, removal, or alteration |
| `?` | named uncertainty linked to its work record |

Do not freeze notation before repeated use proves it helpful. Add a symbol only
when concise words or an existing edge cannot express a recurring relationship.
Use `show-me` when a model needs a compact visual; the visual remains a
projection of the owning text.
