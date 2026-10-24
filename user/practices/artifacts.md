# Artifacts and verification

- Keep source, current contracts, useful fixtures and behavior tests in Git.
  Routine logs, screenshots, source-hash lists, test output and intermediate
  reports are temporary working material.
- Create a durable artifact only for a major outcome: a release, accepted design,
  consequential finding or end-to-end result that someone will use. Bundle its
  result, source revision, check summary, limits and necessary supporting files
  together. Use its README as the single manifest for outcome, source reference,
  final validation summary, limits and retention. One bundle per outcome; no
  separate metadata file, per-step receipt or per-file hash list.
- Verify the delivered result and important failure paths through stable
  interfaces. Run required gates. Validate the final bundle before handoff;
  repeat only after relevant changes or failures. Test behavior, not the presence,
  wording or hashes of historical paperwork. Keep hashes when an executable
  integrity, installation or provenance contract consumes them.
- Use ignored `.artifacts/<outcome>/` for temporary bundles. Keep only captures
  needed to decide or debug; successful routine checks need a result in the
  handoff, not a saved log. Track a final bundle only when it is itself a requested
  deliverable or supports an ongoing claim; otherwise retain a concise outcome
  in the existing owner, with a source revision when useful.
- At closeout, promote accepted decisions and unresolved work to their owners,
  then delete the spent bundle. During later maintenance, delete closed or
  superseded material; review remaining bundles older than 30 days and retain
  only those with a named active need and next review date. No automatic janitor
  or deletion ledger is required. Preserve licenses and explicit retention duties;
  those exceptions need a reason, not an indefinite default.
- Check active users and symlinks before deletion. Repair links and readers.
  Retire a claim when its required evidence is removed. An old pass never proves
  the current build. Git history is available for old committed material; copying
  everything into another archive does not simplify retention.
