# Sources and deeper reasoning

These public sources inform the workflow; treat them as rationale, not as additional mandatory process. Verify the current upstream text before attributing version-specific behavior.

- [Cursor pstack poteto-mode refactoring](https://github.com/cursor/plugins/blob/main/pstack/skills/poteto-mode/playbooks/refactoring.md): protect observable behavior before changing structure and verify actual runtime behavior.
- [Cursor pstack skills](https://github.com/cursor/plugins/tree/main/pstack/skills): subtract-before-you-add, minimize-reader-load, and migrate-callers-then-delete-legacy-apis. Apply removal only after checking ownership and compatibility obligations.
- [Matt Pocock: codebase design](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/SKILL.md): consider interface cost and whether removing an intermediary removes complexity or pushes it onto callers. Explore its DEEPENING.md and DESIGN-IT-TWICE.md only for substantial boundary changes.
- [Matt Pocock: improve codebase architecture](https://github.com/mattpocock/skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md): focus on evidenced friction and relevant history rather than blanket rewrites.
- [Matt Pocock: writing for agents](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md): give rules one authoritative meaning, preserve useful conditions and rationale, and remove text only when intended behavior remains clear.
- [Matt Pocock: grilling](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md): inspect discoverable facts and ask about decisions. Reserve questioning for genuine uncertainty.

Do not import upstream roles, permission assumptions, exhaustive review ceremonies, or tooling requirements into a small cleanup task.
