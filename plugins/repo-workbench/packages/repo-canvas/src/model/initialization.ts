/** User-invoked authoring brief; the owning chat supplies repository-specific judgment. */
export const initializationPrompt = `Initialize a simplified but faithful architecture and feature-design map for this repository, for onboarding and architecture discussions.

Read the repository's agent instructions, architecture/domain docs and relevant source files. Use a bounded stretch of recent commits and relevant previous sessions/discussions for this repository, when available, to identify the most important or frequently discussed concepts and features. Follow those sources back to current implementation; recency alone does not establish architectural importance. State unavailable history or uncertain interpretations explicitly.

Explain the core concepts, a few important use cases and the main data/control flows. Prefer about 4–8 top-level nodes and only a few useful nested concepts. Do not model every file, artifact, test, receipt or runtime detail. Attach source references and concise boundary notes instead of turning supporting evidence into nodes. Label unimplemented designs as proposals; preserve authored notes and accepted decisions.

Return a concise explanation and a complete proposed map through canvas_reply. Keep the existing draft intact until review, Apply to draft and Save. Do not run studies, install software, publish, or scan unrelated personal sessions. This is architecture authoring, not an exhaustive audit or refactor.`;
