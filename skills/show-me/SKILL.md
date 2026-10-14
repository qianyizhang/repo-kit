---
name: show-me
description: Explain a mechanism, relationship, data flow or change with the smallest useful visual grounded in available evidence.
metadata:
  version: "2.0.0"
---

# Show me

Make the key relationship visible. Choose one useful view: a sequence, dependency
map, before/after, representative data state, or short pseudocode. For a broad
change, start with how its main concepts relate before descending into files.

Ground labels in sources you inspected. Mark proposals and uncertain transitions;
an illustrative diagram does not establish observed behavior. Keep prose short
and use it to explain meaning rather than repeat the picture.

For data transformations, read [show the states](references/data-transformations.md)
and trace a representative record through what the consumer sees and what is stored.

Keep the result in conversation by default. For a requested interactive or durable
artifact, use the environment's relevant artifact workflow and verify the result.
No maintained explainer framework is required.

Adapted from HumanLayer's `show-me` at `4d8d644ca747517973f58d7953f58d7cd07520cd`;
retain [LICENSE](LICENSE). Model-first explanation was informed by Geoffrey Litt's
[essay on understanding](https://www.geoffreylitt.com/2026/07/02/understanding-is-the-new-bottleneck).
