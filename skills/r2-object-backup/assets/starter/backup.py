"""Plan, upload, and verify an explicit file inventory in the public Object Library."""

import argparse
import fcntl
import getpass
import hashlib
import json
import os
import re
import sys
from contextlib import contextmanager
from pathlib import Path, PurePosixPath
from tempfile import TemporaryDirectory
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

TOOL = Path(__file__).resolve().parent
MAX = 32 * 1024 * 1024


@contextmanager
def backup_lock(local):
    local.mkdir(parents=True, exist_ok=True)
    with (local / "backup.lock").open("ab") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError("Another backup command is running; retry after it exits") from None
        yield


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=path.parent) as scratch:
        temp = Path(scratch) / "snapshot.json"
        temp.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        temp.replace(path)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def relative(name):
    path = PurePosixPath(name)
    if (
        not name
        or name != path.as_posix()
        or path.is_absolute()
        or any(part in ("..", ".", ".git") for part in path.parts)
        or "\\" in name
        or any(ord(char) < 32 for char in name)
    ):
        raise ValueError(f"Invalid inventory path: {name!r}")
    return path


def contents(root, name):
    path = root / relative(name)
    if path.resolve() != path or not path.is_file():
        raise ValueError(f"Expected regular file with no symlink components: {name}")
    if not 0 < path.stat().st_size <= MAX:
        raise ValueError(f"File must contain 1 byte to 32 MiB: {name}")
    data = path.read_bytes()
    if not 0 < len(data) <= MAX:
        raise ValueError(f"File changed size while reading: {name}")
    return data


def identity(config):
    endpoint = config["endpoint"]
    url = urlsplit(endpoint)
    if (
        url.scheme != "https"
        or not url.hostname
        or url.username
        or url.password
        or url.path
        or url.query
        or url.fragment
    ):
        raise ValueError("Endpoint must be an HTTPS origin")
    namespace = config["namespace"]
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*(?:/[a-z0-9][a-z0-9-]*)+", namespace):
        raise ValueError("Expected a namespace like my-repo/assets")
    return {"endpoint": endpoint, "namespace": namespace}


def same_object(left, right):
    return left["sha256"] == right["sha256"] and left["bytes"] == right["bytes"]


def plan(config, root, manifest):
    target = identity(config)
    paths = config["files"]
    if not isinstance(paths, list) or not all(isinstance(path, str) for path in paths) or len(set(paths)) != len(paths):
        raise ValueError("Inventory must be a list of distinct file paths")
    if not paths:
        raise ValueError("List at least one approved file in inventory.json")
    previous = manifest["files"] if manifest and identity(manifest) == target else {}
    files = {}
    for name in sorted(paths):
        data = contents(root, name)
        row = {"sha256": sha(data), "bytes": len(data)}
        if name in previous and same_object(previous[name], row):
            row["key"] = previous[name]["key"]
        files[name] = row
    return {**target, "version": 1, "files": files}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request(endpoint, route, query, data=None, headers=None):
    req = Request(
        f"{endpoint}{route}?{urlencode(query)}",
        data=data,
        headers={"User-Agent": "ObjectLibraryCLI/1.1", **(headers or {})},
    )
    with build_opener(NoRedirect()).open(req, timeout=35) as response:
        payload = response.read(MAX + 1)
    if len(payload) > MAX:
        raise ValueError("Object Library response exceeds 32 MiB")
    return payload


def checked(data, row):
    if len(data) != row["bytes"] or sha(data) != row["sha256"]:
        raise ValueError("Object length or SHA-256 mismatch")
    return data


def download(target, row):
    key = row["key"]
    if not key.startswith(f"library/{target['namespace']}/"):
        raise ValueError("Download key is outside the configured namespace")
    return checked(request(target["endpoint"], "/download", {"key": key}), row)


def upload(target, root, journal, limit):
    target_id = identity(target)
    saved = read_json(journal) if journal.is_file() else {**target_id, "files": {}}
    if identity(saved) != target_id:
        raise ValueError("The upload journal belongs to another endpoint or namespace")
    verified = saved["files"]
    pending = [
        (name, row)
        for name, row in target["files"].items()
        if "key" not in row and not (name in verified and same_object(row, verified[name]))
    ]
    secret = os.environ.get("OBJECT_LIBRARY_UPLOAD_PASSWORD")
    if pending and not secret and sys.stdin.isatty():
        secret = getpass.getpass("Object Library upload password: ")
    if pending and (not secret or "\n" in secret or "\r" in secret):
        raise ValueError("Use OBJECT_LIBRARY_UPLOAD_PASSWORD or the hidden prompt")
    for name, row in pending[:limit]:
        data = checked(contents(root, name), row)
        path = relative(name)
        folder = "/".join((target["namespace"], *path.parts[:-1]))
        receipt = json.loads(
            request(
                target["endpoint"],
                "/api/upload",
                {"folder": folder, "name": path.name},
                data,
                {
                    "Content-Type": "application/octet-stream",
                    "x-content-sha256": row["sha256"],
                    "x-upload-password": secret,
                },
            )
        )
        result = {**row, "key": receipt["key"]}
        download(target, result)
        verified[name] = result
        write_json(journal, saved)
        print(f"Verified {name}", flush=True)
    print(f"{max(0, len(pending) - limit)} files pending")


def recorded(target, journal):
    saved = read_json(journal) if journal.is_file() else {**identity(target), "files": {}}
    if identity(saved) != identity(target):
        raise ValueError("The upload journal belongs to another endpoint or namespace")
    files = {}
    for name, row in target["files"].items():
        verified = row if "key" in row else saved["files"].get(name)
        if not verified or not same_object(row, verified):
            raise ValueError(f"Sync incomplete: {name}")
        files[name] = verified
    return {**target, "files": files}


def restore(manifest, output):
    target = identity(manifest)
    if manifest["version"] != 1:
        raise ValueError("Unsupported manifest version")
    if output.exists() or output.is_symlink():
        raise ValueError("Use a new restore destination")
    output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=output.parent) as scratch:
        tree = Path(scratch) / "assets"
        tree.mkdir()
        for name, row in manifest["files"].items():
            path = tree / relative(name)
            data = download(target, row)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        if output.exists() or output.is_symlink():
            raise ValueError("Restore destination appeared during download")
        tree.rename(output)
    print(f"Restored {len(manifest['files'])} files")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("plan", "upload", "record", "restore"))
    parser.add_argument("--public-approved", action="store_true")
    parser.add_argument("--limit", type=int, default=9, choices=range(1, 10))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.action in ("record", "restore") and args.output is None:
        parser.error(f"{args.action} requires a new --output path")
    if args.action == "upload" and not args.public_approved:
        parser.error("upload requires --public-approved for the reviewed files and names")

    manifest = TOOL / "manifest.json"
    local = TOOL / ".local"
    prepared = local / "plan.json"
    journal = local / "verified.json"
    with backup_lock(local):
        if args.action == "restore":
            restore(read_json(manifest), args.output)
            return
        root = TOOL.parent
        current = plan(read_json(TOOL / "inventory.json"), root, read_json(manifest) if manifest.is_file() else None)
        if args.action == "plan":
            write_json(prepared, current)
            print(f"Review {prepared}")
            return
        if current != read_json(prepared):
            raise ValueError("Inventory or source bytes changed; review a new plan")
        if args.action == "upload":
            upload(current, root, journal, args.limit)
        else:
            final = recorded(current, journal)
            restore(final, args.output)
            write_json(manifest, final)


if __name__ == "__main__":
    try:
        main()
    except HTTPError as error:
        detail = error.headers.get("Retry-After", "600")
        wait = f"; wait {detail if detail.isdecimal() else '600'} seconds" if error.code == 429 else ""
        raise SystemExit(f"Object Library HTTP {error.code}{wait}; stopped") from None
    except (OSError, ValueError, KeyError) as error:
        raise SystemExit(f"Object backup: {error}") from None
