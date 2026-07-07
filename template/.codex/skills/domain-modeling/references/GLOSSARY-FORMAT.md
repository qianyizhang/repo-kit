# Glossary Format

Glossary files live under `docs/glossary/` (e.g. `ddd.md` plus any repo-specific
files) and are organized as bilingual tables grouped by Bounded Context (for DDD)
or semantic category.

## Table Structure

Each glossary file should contain tables with the following headers:

| Term | Full Form | 中文 | 中文解释 | _Avoid_ |
| :--- | :--- | :--- | :--- | :--- |
| `ExampleTerm` | Example Term | 示例术语 | 面向目标读者的一句话解释。 | AliasToAvoid |

(Swap the `中文 / 中文解释` columns for whatever the repo's reader-audience
language is; keep the `Term` column in English so it matches code.)

## Rules

1. **Ubiquitous Language**: Term names MUST match class/field/API naming in code
   exactly (or follow standard naming conventions).
2. **Be Opinionated**: When multiple words exist for the same concept, pick the
   best one and list the others under `_Avoid_` to enforce consistent vocabulary.
3. **No General Code Terms**: Terms must be specific to this project's domain
   (don't define generic concepts like "JSON", "API Router", "Middleware" even if
   the project uses them extensively).
4. **Group by Context**: For `ddd.md`, terms must be organized into sections/tables
   per Bounded Context.
