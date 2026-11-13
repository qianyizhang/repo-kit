---
name: r2-object-backup
description: Set up, sync, verify, or restore a Git-backed asset inventory on an R2 Object Library. Use for approved public binary assets, repository namespaces, or fresh-checkout recovery.
---

Use the repository's existing backup tool and rulebook if it has them. The
repository owns the asset inventory, namespace, format, rights, and recovery
acceptance. This skill owns the shared procedure. Never put private assets or
credentials on the public Object Library.

1. **Prepare.** Confirm the endpoint, its current limits, and public approval
   for the exact bytes and names. Plan from an explicit inventory. Store
   metadata, immutable keys, byte lengths, and SHA-256 hashes in Git. Review
   the plan before uploading; keep the previous verified manifest intact.
2. **Sync.** Upload only missing content. Send the password via
   `x-upload-password`, omit `Origin` in a CLI, and do not log credentials
   or follow redirects. Read each object back and verify its length and hash
   before recording progress. Wait the full provider rate window between
   nonempty batches and honor `Retry-After`; stop on 403 and
   distinguish edge/client blocks from credential rejection using public
   status and response type. Share only a safe API error/code if present.
3. **Prove recovery.** Download into a new directory, verify every object,
   and run the consumer's checks before publishing the Git manifest. Confirm
   a repeat sync with no changes needs no uploads. Retain an independent copy;
   this service has no retention or deletion recovery guarantee.

For a new repository with ordinary files, use the [scaffold](references/scaffold.md).
For assembled assets, keep the repository's existing packer and restore format;
do not migrate them merely to adopt this skill.
