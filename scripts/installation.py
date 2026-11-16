#!/usr/bin/env python3
"""Report installed repo-kit instructions and skills against one committed revision."""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import re
import subprocess
import tempfile
from collections.abc import Iterator, Mapping, Sequence
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INSTRUCTION_PATHS = ("user",)
SKILL_PATHS = ("skills", "skills-lock.json")


def valid_revision(value: object) -> bool:
    return value is None or (isinstance(value, str) and re.fullmatch(r"[a-f0-9]{40}", value) is not None)


def git(root: Path, *args: str, data: bytes | None = None) -> bytes:
    result = subprocess.run(["git", "-C", str(root), *args], input=data, capture_output=True, check=False)
    if result.returncode:
        raise ValueError(result.stderr.decode(errors="replace").strip())
    return result.stdout


def resolve_revision(root: Path, revision: str) -> str:
    return git(root, "rev-parse", "--verify", "--end-of-options", f"{revision}^{{commit}}").decode().strip()


def revision_files(root: Path, revision: str, paths: Sequence[str]) -> dict[str, bytes]:
    entries = git(root, "ls-tree", "-rz", "--full-tree", revision, "--", *paths)
    objects: dict[str, bytes] = {}
    for entry in entries.split(b"\0"):
        if not entry:
            continue
        info, name = entry.decode().split("\t", 1)
        mode, kind, object_id = info.split()
        if kind != "blob" or mode not in {"100644", "100755"}:
            raise ValueError(f"Unsupported committed bundle entry: {name}")
        objects[name] = object_id.encode("ascii")
    if not objects:
        return {}

    requests = b"\n".join(objects.values()) + b"\n"
    content: dict[str, bytes] = {}
    with io.BytesIO(git(root, "cat-file", "--batch", data=requests)) as stream:
        for name, object_id in objects.items():
            header = stream.readline().split()
            if header == [object_id, b"missing"]:
                raise ValueError(f"Missing committed bundle blob: {name}")
            if len(header) != 3 or header[:2] != [object_id, b"blob"] or not header[2].isdigit():
                raise ValueError(f"Invalid committed bundle blob header: {name}")
            # Blob contents can contain newlines and NULs; only the header is a line.
            size = int(header[2])
            blob = stream.read(size)
            if len(blob) != size or stream.read(1) != b"\n":
                raise ValueError(f"Incomplete committed bundle blob: {name}")
            content[name] = blob
        if stream.read(1):
            raise ValueError("Unexpected data after committed bundle blobs")
    return content


def matching_revision(root: Path, paths: Sequence[str], content: Mapping[str, bytes]) -> str | None:
    """Identify HEAD only when this entire source bundle has the committed bytes."""
    try:
        if Path(git(root, "rev-parse", "--show-toplevel").decode().strip()).resolve() != root.resolve():
            return None
        revision = resolve_revision(root, "HEAD")
        return revision if revision_files(root, revision, paths) == content else None
    except (OSError, ValueError):
        return None


@contextlib.contextmanager
def source(root: Path, revision: str | None, paths: Sequence[str]) -> Iterator[tuple[Path, str | None]]:
    """Materialize only selected committed data; never read unfinished worktree data."""
    if revision is None:
        yield root, None
        return
    commit = resolve_revision(root, revision)
    content = revision_files(root, commit, paths)
    with tempfile.TemporaryDirectory(prefix="repo-kit-source-") as directory:
        snapshot = Path(directory)
        for name, data in content.items():
            destination = snapshot / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
        yield snapshot, commit


def main() -> int:
    if __package__:
        from . import skills, user_instructions
    else:
        import user_instructions

        import skills

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("status",))
    parser.add_argument("--revision", default="HEAD")
    parser.add_argument("--codex-home", type=Path, default=Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex"))
    parser.add_argument("--installed-root", type=Path, default=Path.home() / ".agents/skills")
    args = parser.parse_args()
    try:
        with source(ROOT, args.revision, (*INSTRUCTION_PATHS, *SKILL_PATHS)) as (snapshot, revision):
            print(f"Expected source: {revision}")
            current = True
            for label, module, target in (
                ("Instructions", user_instructions, args.codex_home),
                ("Skills", skills, args.installed_root),
            ):
                target = target.expanduser().resolve()
                print(f"{label} destination: {target}")
                try:
                    matches = module.sync(snapshot, target)
                    receipt_path = target / module.RECEIPT
                    receipt = json.loads(receipt_path.read_text()) if receipt_path.is_file() else {}
                    print(f"{label}: {'CURRENT' if matches else 'OUTDATED'}")
                    print(
                        f"Installed source: {receipt.get('sourceRevision') or 'unknown (legacy or uncommitted source)'}"
                    )
                    current = current and matches
                except (OSError, ValueError, KeyError, TypeError) as exc:
                    print(f"{label}: ERROR: {exc}")
                    current = False
            return int(not current)
    except (OSError, ValueError) as exc:
        parser.exit(1, f"installation: {exc}\n")


if __name__ == "__main__":
    raise SystemExit(main())
