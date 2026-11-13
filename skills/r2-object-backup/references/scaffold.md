# Scaffold a repository backup

Run the bundled generator with Python 3.12:

```sh
python3.12 <skill-dir>/scripts/scaffold.py \
  --target object-backup --namespace my-repo/assets
```

The target must be new. It contains a standard-library client, an empty file
inventory, and a guide. No credentials, asset copies, dependencies, or remote
writes are created by the generator. The output works without the skill installed.
Use it for independent files below the provider's per-file limit. For custom
packing, multiple delivery revisions, or private data, select the repository's
own tool or an authenticated storage backend.

The default provider is the [public Object Library](https://r2-object-library.landy123007.chatgpt.site/api-guide.md).
The API limits uploads to 32 MiB per file and 10 attempts per IP per 600 seconds.
The generated client sends at most nine files per invocation and does not retry
POSTs automatically. Inspect the plan, then wait the full rate window between
nonempty batches. The ignored journal survives a failed batch. A new plan can
reuse verified entries whose full content identity matches. No delete endpoint
is used, and a removed file only disappears from a later Git manifest.
The starter deliberately refuses an empty inventory; retiring the entire
backup is a separate action.
