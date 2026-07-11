# Glossary Format

Glossary files live under `docs/glossary/` (for example, `ddd.md` plus any
repo-specific files) and are organized as bilingual tables grouped by Bounded
Context (for DDD) or semantic category.

## Table Structure

Each glossary file should contain tables with the following headers:

| Term | Full Form | 中文 | 中文解释 | _Avoid_ |
| :--- | :--- | :--- | :--- | :--- |
| `ExampleTerm` | Example Term | 示例术语 | 面向目标读者的一句话解释。 | AliasToAvoid |

Swap the `中文 / 中文解释` columns for the repo's reader-audience language when
needed. Keep the `Term` column in English so it matches code.

## Rules

1. **Ubiquitous Language**: Term names MUST match class/field/API naming in code
   exactly (or follow standard naming conversions).
2. **Be Opinionated**: When multiple words exist for the same concept, pick the
   best one and list the others under `_Avoid_` to enforce consistent vocabulary.
3. **No General Code Terms**: Terms must be specific to the consumer repo's
   domain. Do not define generic concepts such as "JSON", "API Router", or
   "Middleware" merely because the project uses them.
4. **Group by Context**: For `ddd.md`, organize terms into sections or tables per
   Bounded Context.
5. **Drill-friendly brevity**: Quiz glosses are definitions only (`中文解释`, or
   confusable `Meaning` plus `中文释义`). The translated term-name column is a
   label, not quiz content; a direct calque can leak the answer. Put long policy
   caveats in the owning authority document.

| Term | Owning BC | 中文 | Meaning | 中文释义 | ≠ (do not confuse) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DraftItem` | `example` | 草稿项 | Unreviewed domain item. | 未经审核的领域项。 | ApprovedItem |

`≠` is a **comma-separated neighbor list**, not an essay.
