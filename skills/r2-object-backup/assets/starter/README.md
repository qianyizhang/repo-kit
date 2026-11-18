# Object backup

List approved files in `inventory.json` as paths relative to the repository
root. Keep the inventory, client and verified `manifest.json` in Git. The
provider exposes object bytes and names publicly; keep private data out.
The client uses Python 3.12 on macOS or Linux.

From the repository root, assuming the scaffold was generated at
`object-backup/`:

```sh
python3.12 object-backup/backup.py plan
python3.12 object-backup/backup.py upload --public-approved
python3.12 object-backup/backup.py record --output .local/backup-review
python3.12 object-backup/backup.py restore --output .local/restored-assets
```

Review the plan before uploading. Supply `OBJECT_LIBRARY_UPLOAD_PASSWORD` in
the environment or at the hidden prompt. Upload stops on failure and saves
verified entries; resume with the same inventory after observing the provider's
rate window. An unchanged upload needs no password. Record refuses incomplete
work and verifies a full restore before changing the manifest. Restore needs
no credential. Use a new output directory each time. Keep an independent copy.

Run one command at a time per checkout. A concurrent command exits before it
can modify the plan, journal or manifest. The lock releases when the holder exits,
including after interruption. Leave `.local/backup.lock` in place during use.
