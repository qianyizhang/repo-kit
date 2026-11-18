# Artifacts and verification

| Material | Outcome |
| --- | --- |
| Source, active contracts, useful fixtures and behavior tests | Keep in Git. |
| Release, accepted design, consequential finding or usable end-to-end result | One bundle per major outcome. Its README records result, source revision, check summary, limits and retention. Include only supporting files needed to use or verify it. |
| Logs, working captures and intermediate reports | Temporary, under ignored `.artifacts/<outcome>/` where a bundle is useful. A routine check needs only its handoff result. |
| Durable evidence | Track a bundle when requested or needed for an active claim. Otherwise record the outcome in its existing owner. Keep hashes consumed by integrity, installation or provenance checks. |

- **Acceptance** · Validate the delivered bundle and failure paths through stable interfaces. Recheck changed inputs or failures. Historical paperwork alone does not establish current behavior. [Delivery verification](github.md#final-verification)
- **Closeout** · Promote accepted decisions and unresolved work to their owners. Retire spent bundles and superseded records. Review remaining bundles after 30 days and retain only those with an active need and next review date. Preserve licenses and explicit retention duties with their rationale.
- **Safe retirement** · Check active readers and symlink targets. Repair links and routes. Retire claims whose necessary evidence is removed. Recover previously committed material from Git when needed.
