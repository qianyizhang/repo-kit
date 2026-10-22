#!/usr/bin/env python3
"""Check, diff or explicitly sync repo-kit's personal Codex instruction bundle."""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECEIPT = ".repo-kit-user-instructions.json"
BACKUPS = ".repo-kit-user-instruction-backups"


def digest(data: bytes | None) -> str | None:
    return hashlib.sha256(data).hexdigest() if data is not None else None


def managed_name(name: str) -> bool:
    return name == "AGENTS.md" or bool(re.fullmatch(r"practices/(?:README|[a-z][a-z0-9-]*)\.md", name))


def read_file(path: Path) -> bytes | None:
    if path.is_symlink() or (path.exists() and not path.is_file()):
        raise ValueError(f"Expected a regular file, refusing symlink or other entry: {path}")
    return path.read_bytes() if path.exists() else None


def real_directory(path: Path) -> None:
    if path.is_symlink() or (path.exists() and not path.is_dir()):
        raise ValueError(f"Expected a real directory, refusing symlink or other entry: {path}")


def managed_path(home: Path, name: str) -> Path:
    if not managed_name(name):
        raise ValueError(f"Invalid managed instruction path: {name}")
    if name.startswith("practices/"):
        real_directory(home / "practices")
    return home / name


def source_files(root: Path) -> dict[str, Path]:
    directory = root / "user"
    real_directory(directory)
    real_directory(directory / "practices")
    sources = {
        "AGENTS.md": directory / "AGENTS.md",
        "practices/python.md": root / "template/docs/rules/python.md",
    }
    if (directory / "practices").exists():
        for path in sorted((directory / "practices").iterdir()):
            name = f"practices/{path.name}"
            if name in sources:
                raise ValueError(f"Duplicate instruction source: {name}; edit {sources[name]}")
            sources[name] = managed_path(directory, name)
    return sources


def source_bundle(root: Path) -> dict[str, bytes]:
    content = {}
    for name, path in source_files(root).items():
        data = read_file(path)
        if data is None or not data.strip():
            raise ValueError(f"User instruction source is missing or empty: {name}")
        data.decode("utf-8")
        content[name] = data
    return content


def hashes(content: dict[str, bytes | None]) -> dict[str, str | None]:
    return {name: digest(data) for name, data in content.items()}


def atomic_write(path: Path, data: bytes) -> None:
    mode = path.stat().st_mode & 0o777 if path.exists() else 0o600
    with tempfile.NamedTemporaryFile(prefix=".repo-kit-user-", dir=path.parent, delete=False) as stream:
        staged = Path(stream.name)
        try:
            stream.write(data)
            stream.close()
            staged.chmod(mode)
            os.replace(staged, path)
        finally:
            staged.unlink(missing_ok=True)


def write_receipt(path: Path, installed: dict, pending: dict | None = None) -> None:
    value = {"schemaVersion": 2, "installed": installed}
    if pending is not None:
        value["pending"] = pending
    atomic_write(path, (json.dumps(value, indent=2, sort_keys=True) + "\n").encode())


def valid_hashes(value: object, *, allow_absent: bool) -> bool:
    return (
        isinstance(value, dict)
        and "AGENTS.md" in value
        and all(
            managed_name(name)
            and ((item is None and allow_absent) or (isinstance(item, str) and re.fullmatch(r"[a-f0-9]{64}", item)))
            for name, item in value.items()
        )
    )


def read_receipt(path: Path) -> dict | None:
    raw = read_file(path)
    if raw is None:
        return None
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("Invalid user-instruction receipt; preserve and reconcile it manually")
    if (
        value.get("schemaVersion") != 2
        or set(value) not in ({"schemaVersion", "installed"}, {"schemaVersion", "installed", "pending"})
        or not valid_hashes(value["installed"], allow_absent="pending" in value)
        or (
            "pending" in value
            and (
                not valid_hashes(value["pending"], allow_absent=False)
                or value["pending"].keys() != value["installed"].keys()
            )
        )
    ):
        raise ValueError("Invalid user-instruction receipt; preserve and reconcile it manually")
    return value


def preserve(home: Path, content: bytes | None) -> None:
    directory = home / BACKUPS
    real_directory(directory)
    if content is None:
        return
    directory.mkdir(exist_ok=True)
    path = directory / f"{digest(content)}.md"
    saved = read_file(path)
    if saved is None:
        with path.open("xb") as stream:
            stream.write(content)
        path.chmod(0o600)
    elif saved != content:
        raise ValueError(f"Recovery copy changed; preserve and reconcile it: {path}")


def sync(
    root: Path,
    home: Path,
    *,
    apply: bool = False,
    show_diff: bool = False,
    adopt: dict[str, str] | None = None,
) -> bool:
    home = home.expanduser().resolve()
    if (root / "user").resolve() == home:
        raise ValueError("The installation must be separate from the repository source")
    desired = source_bundle(root)
    adopt = adopt or {}
    if adopt.keys() - desired.keys():
        raise ValueError("Adoption names must be present in the source bundle")
    if (read_file(home / "AGENTS.override.md") or b"").strip():
        raise ValueError("AGENTS.override.md shadows this installation; reconcile the override first")
    receipt_path = home / RECEIPT
    receipt = read_receipt(receipt_path)
    installed = receipt["installed"] if receipt else {}
    pending = receipt.get("pending", {}) if receipt else {}
    retired = installed.keys() - desired.keys()
    if retired:
        raise ValueError(
            f"Managed sources removed; explicitly reconcile retirement first: {', '.join(sorted(retired))}"
        )
    actual = {name: read_file(managed_path(home, name)) for name in desired}
    actual_hashes, desired_hashes = hashes(actual), hashes(desired)
    problems = []
    for name, data in desired.items():
        actual_hash = actual_hashes[name]
        if actual[name] != data:
            print(f"{name}: {actual_hash or 'absent'} -> {desired_hashes[name]}")
            if show_diff:
                print(
                    "".join(
                        difflib.unified_diff(
                            (actual[name] or b"").decode("utf-8").splitlines(True),
                            data.decode("utf-8").splitlines(True),
                            fromfile=str(home / name),
                            tofile=str(source_files(root)[name]),
                        )
                    ),
                    end="",
                )
        accepted = {installed.get(name)}
        if name in pending:
            accepted.add(pending[name])
        adopted = name in adopt and actual_hash is not None and adopt[name] == actual_hash
        if name in adopt and not adopted:
            problems.append(f"{name}: adoption requires a file matching the reviewed hash")
        elif actual_hash not in accepted and not adopted:
            reason = "local edits or missing file" if name in installed else "unmanaged installation"
            problems.append(
                f"{name}: {reason} (installed SHA-256: {actual_hash or 'absent'}); "
                f"review diff and reconcile before --adopt {name}=SHA256"
            )
    if problems:
        if apply:
            raise ValueError("\n".join(problems))
        print("\n".join(problems))
        return False
    current = receipt is not None and not pending and installed == desired_hashes == actual_hashes
    if not apply or current:
        status = f"User instructions are current ({len(desired)} files)" if current else "Sync required"
        print(status + (" (interrupted update)" if pending else ""))
        return current
    home.mkdir(parents=True, exist_ok=True)
    for content in actual.values():
        preserve(home, content)
    if any(read_file(managed_path(home, name)) != content for name, content in actual.items()):
        raise ValueError("Installed instructions changed during review; retry from diff")
    write_receipt(receipt_path, actual_hashes, desired_hashes)
    # Install references before the routing instruction; a crash may leave a known mixture.
    for name in sorted(desired, key=lambda name: (name == "AGENTS.md", name)):
        path = managed_path(home, name)
        if read_file(path) != actual[name]:
            raise ValueError(f"{name} changed during sync; preserve and reconcile it before retrying")
        if actual[name] != desired[name]:
            path.parent.mkdir(exist_ok=True)
            atomic_write(path, desired[name])
    write_receipt(receipt_path, desired_hashes)
    print(f"Synced user instructions: {home} ({len(desired)} files)")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("check", "diff", "sync"))
    parser.add_argument("--codex-home", type=Path, default=Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex"))
    parser.add_argument(
        "--adopt", action="append", default=[], metavar="FILE=SHA256", help="Accept one reviewed local file"
    )
    args = parser.parse_args()
    if args.adopt and args.command != "sync":
        parser.error("--adopt applies only to sync")
    try:
        adopt = {}
        for entry in args.adopt:
            name, separator, value = entry.partition("=")
            if not separator or not managed_name(name) or not re.fullmatch(r"[a-f0-9]{64}", value) or name in adopt:
                raise ValueError("Each --adopt must name a distinct managed FILE=SHA256")
            adopt[name] = value
        current = sync(
            ROOT, args.codex_home, apply=args.command == "sync", show_diff=args.command == "diff", adopt=adopt
        )
        return int(args.command == "check" and not current)
    except (OSError, ValueError, TypeError) as exc:
        parser.exit(1, f"user-instructions: {exc}\n")


if __name__ == "__main__":
    raise SystemExit(main())
