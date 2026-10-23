---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Stress-test the material decisions within the requested scope. Map them as a **design tree**: each decision exposes the choices that depend on it. Reuse accepted decisions; explore only branches that can change the result.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

Format a round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Word each question so "yes" accepts your recommended answer.

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job. Resolve small lookups directly. Delegate independent exploration when its benefit justifies the coordination and delegation is authorized; state the split once. A running exploration is an unsettled prerequisite: defer only dependent questions. Ask the user for decisions, not facts available in the environment.

The interview is complete when no material choice remains unresolved. Clear acceptance, including "all your recommendations," locks those choices and satisfies confirmation. Continue authorized implementation without another approval round. Reopen a choice only for new evidence or a material conflict; name what changed. An interview alone adds no execution authority.
