---
name: show-me
description: Explain a mechanism, relationship, data flow or change with the smallest useful visual grounded in available evidence.
metadata:
  version: "2.0.0"
---

# Show me

Make the key relationship visible. Choose by the reader's question, not the renderer:

| Question | Useful view |
| --- | --- |
| What are the parts, dependencies, and boundaries? | Component/dependency map |
| Which actions, decisions, and owners move work forward? | Workflow |
| Who calls whom, in what order, and what returns? | Sequence |
| Which states are possible, and what triggers transitions or retries? | State/lifecycle |
| Where does data move, and how does it change? | Data flow with representative states |
| When did events happen? | Timeline |
| Where was time spent, including overlap? | Waterfall |
| What changed? | Before/after |

Use short pseudocode when it explains a local algorithm more directly. For a broad
change, show how the main concepts relate before descending into files. Start with
one readable view; split detail out when labels or crossings obscure the main path.
Keep behavior-changing conditions and boundaries visible when grouping.

Ground meaningful labels, edges, and conditions in sources you inspected. A drawn
dependency or call is not an observed runtime trace. Mark proposals and unknowns
beside the affected claim. Distinguish recorded dates and durations from illustrative
timing; leave unavailable measurements unknown. Keep prose short and explain meaning
rather than repeat the picture.

For data transformations, read [show the states](references/data-transformations.md)
and trace a representative record through what the consumer sees and what is stored.

Keep the result in conversation by default. For a requested interactive or durable
artifact, use the environment's relevant artifact workflow and verify the result.
Report only checks actually run; rendering does not establish runtime behavior or
visual review. No maintained explainer framework is required.

Adapted from HumanLayer's `show-me` at `4d8d644ca747517973f58d7953f58d7cd07520cd`;
retain [LICENSE](LICENSE). Model-first explanation was informed by Geoffrey Litt's
[essay on understanding](https://www.geoffreylitt.com/2026/07/02/understanding-is-the-new-bottleneck).
Question-led view selection and evidence boundaries are informed by
[Archify](https://github.com/tt-a1i/archify/blob/25cf37080fc8b1dbe758a4efc3935b55f3327083/archify/SKILL.md).
