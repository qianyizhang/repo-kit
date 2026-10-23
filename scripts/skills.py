#!/usr/bin/env python3
"""Verify, review and synchronize the shared skill bundle using only Python stdlib."""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM_SKILLS = (
    "retro",
    "improve-codebase-architecture",
    "codebase-design",
    "domain-modeling",
    "grilling",
    "writing-for-agents",
)
LOCAL_SKILLS = ("next-slice", "show-me", "finish-work", "simplify-repository", "ui-discussion", "mcp-app")
RECEIPT = ".repo-kit-skills.json"
INTERRUPTED = ".repo-kit-skills-interrupted.json"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def files(root: Path) -> dict[str, bytes]:
    result = {}
    if root.exists():
        for path in sorted(root.rglob("*")):
            if path.is_symlink():
                raise ValueError(f"Symlink inside managed tree: {path}")
            if path.is_file():
                result[path.relative_to(root).as_posix()] = path.read_bytes()
    return result


def hashes(content: dict[str, bytes]) -> dict[str, str]:
    return {path: digest(data) for path, data in content.items()}


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def validate_content(content: dict) -> None:
    names = UPSTREAM_SKILLS + LOCAL_SKILLS
    for path in content:
        if path != "mattpocock-LICENSE" and ("/" not in path or path.split("/")[0] not in names):
            raise ValueError(f"Unexpected bundle path: {path}")
    for name in names:
        if f"{name}/SKILL.md" not in content:
            raise ValueError(f"Missing skill manifest: {name}")
    if "mattpocock-LICENSE" not in content:
        raise ValueError("Missing upstream license")


def read_lock(root: Path) -> dict:
    lock = json.loads((root / "skills-lock.json").read_text(encoding="utf-8"))
    if lock.get("schemaVersion") not in (1, 2) or set(lock["skills"]) != set(UPSTREAM_SKILLS + LOCAL_SKILLS):
        raise ValueError("Invalid skill lock schema or selection")
    for inventory in (lock["files"], lock["upstream"]["files"]):
        for path, value in inventory.items():
            if Path(path).is_absolute() or ".." in Path(path).parts or not re.fullmatch(r"[a-f0-9]{64}", value):
                raise ValueError(f"Invalid locked path or digest: {path}")
    validate_content(lock["files"])
    adaptations = lock.get("adaptations", {})
    if not isinstance(adaptations, dict) or (lock["schemaVersion"] == 1 and adaptations):
        raise ValueError("Adaptations require skill lock schema 2")
    for path, reason in adaptations.items():
        if (
            path not in {f"{name}/SKILL.md" for name in UPSTREAM_SKILLS}
            or path not in lock["upstream"]["files"]
            or not isinstance(reason, str)
            or not reason.strip()
        ):
            raise ValueError(f"Invalid adaptation path or reason: {path}")
    validate_upstream(lock, lock["files"])
    return lock


def validate_upstream(lock: dict, inventory: dict[str, str]) -> None:
    baseline = lock["upstream"]["files"]
    actual = {p: h for p, h in inventory.items() if p.split("/")[0] in UPSTREAM_SKILLS or p == "mattpocock-LICENSE"}
    if set(actual) != set(baseline) or any(
        actual[p] != baseline[p] for p in actual if p not in lock.get("adaptations", {})
    ):
        raise ValueError("Upstream files changed outside declared adaptations; review an upstream refresh")


def bundle(root: Path) -> tuple[dict, dict[str, bytes]]:
    lock = read_lock(root)
    content = files(root / "skills")
    if hashes(content) != lock["files"]:
        raise ValueError("Bundle differs from skills-lock.json; review changes and run lock or refresh")
    return lock, content


def installed_files(target: Path, names: list[str]) -> dict[str, bytes]:
    content = {}
    for name in names:
        path = target / name
        if path.is_symlink() or (path.exists() and not path.is_dir()):
            raise ValueError(f"Managed skill must be a real directory: {path}")
        content.update({f"{name}/{p}": data for p, data in files(path).items()})
    license_path = target / "mattpocock-LICENSE"
    if license_path.is_symlink():
        raise ValueError(f"Managed license must be a real file: {license_path}")
    if license_path.exists():
        content["mattpocock-LICENSE"] = license_path.read_bytes()
    return content


def changes(before: dict[str, bytes], after: dict[str, bytes]) -> list[str]:
    return [p for p in sorted(before.keys() | after.keys()) if before.get(p) != after.get(p)]


def entry_hashes(path: Path) -> dict[str, str]:
    if path.is_symlink():
        raise ValueError(f"Skill recovery refuses symlinks: {path}")
    if path.is_dir():
        return hashes(files(path))
    return {"": digest(path.read_bytes())} if path.exists() else {}


def recover_installation(target: Path, *, apply: bool) -> None:
    """Roll back a known interrupted replacement; never infer ownership from missing files."""
    marker = target / INTERRUPTED
    if marker.is_symlink():
        raise ValueError("Interrupted installation record must not be a symlink")
    if not marker.exists():
        return
    if not apply:
        raise ValueError("Interrupted installation; run sync to verify recovery and retry")
    record = json.loads(marker.read_text())
    names = [*UPSTREAM_SKILLS, *LOCAL_SKILLS, "mattpocock-LICENSE", RECEIPT]
    if (
        record.get("schemaVersion") != 1
        or not re.fullmatch(r"[a-f0-9]{16}(?:-[\w-]+)?", record["recovery"])
        or set(record["before"]) != set(names)
        or set(record["after"]) != set(names)
    ):
        raise ValueError("Invalid interrupted installation record; reconcile manually")
    recovery = target.resolve().parent / ".repo-kit-skill-backups" / record["recovery"]
    if recovery.is_symlink() or recovery.parent.is_symlink() or not recovery.is_dir():
        raise ValueError("Skill recovery backup is unavailable; reconcile manually")
    # Validate every path before moving any: a user edit anywhere blocks the whole recovery.
    for name in names:
        before, after = record["before"][name], record["after"][name]
        actual, backup = entry_hashes(target / name), entry_hashes(recovery / name)
        if (
            actual not in (before, after, {})
            or (backup and backup != before)
            or (actual != before and before and backup != before)
            or (name != RECEIPT and (target / name).is_dir() and not actual and before != {})
        ):
            raise ValueError(f"Skill recovery stopped: {name} changed; preserve and reconcile it first")
    # A committed receipt plus complete matching content means only record removal was interrupted.
    if all(entry_hashes(target / name) == record["after"][name] for name in names):
        marker.unlink()
        return
    with tempfile.TemporaryDirectory(prefix=".repo-kit-recover-", dir=target) as stage_name:
        stage = Path(stage_name)
        (stage / "discard").mkdir()
        for name in names:
            dest = target / name
            if entry_hashes(dest) == record["before"][name]:
                continue
            source = recovery / name
            if record["before"][name]:
                if source.is_dir():
                    shutil.copytree(source, stage / name)
                else:
                    shutil.copy2(source, stage / name)
            # Renames leave each destination old, new, or absent, even if rollback is interrupted.
            if dest.exists():
                os.replace(dest, stage / "discard" / name)
            if record["before"][name]:
                os.replace(stage / name, dest)
    marker.unlink()
    print("Recovered previous skill installation; retrying requested sync")


def sync(root: Path, target: Path, *, apply: bool = False, show_diff: bool = False) -> bool:
    lock, desired = bundle(root)
    recover_installation(target, apply=apply)
    receipt_path = target / RECEIPT
    if receipt_path.is_symlink():
        raise ValueError("Installation receipt must not be a symlink")
    receipt = json.loads(receipt_path.read_text()) if receipt_path.exists() else None
    if receipt and (receipt.get("schemaVersion") != 1 or not set(receipt["skills"]) <= set(lock["skills"])):
        raise ValueError("Installation selection changed; explicitly reconcile retired skills first")
    actual = installed_files(target, lock["skills"])
    if apply:
        added_names = set(lock["skills"]) - set(receipt["skills"] if receipt else ())
        if any((target / name).exists() for name in added_names):
            raise ValueError("Unmanaged skill collision; reconcile existing copies before installation")
        if receipt is None and actual:
            raise ValueError("Unmanaged skill collision; reconcile existing copies before installation")
        if receipt and hashes(actual) != receipt["files"]:
            raise ValueError("Installed skills have local edits or missing files; preserve and reconcile them first")
    changed = changes(actual, desired)
    for path in changed:
        action = "add" if path not in actual else "remove" if path not in desired else "change"
        print(f"{action}: {path}")
        if show_diff and path in actual and path in desired:
            print(
                "".join(
                    difflib.unified_diff(
                        actual[path].decode().splitlines(True),
                        desired[path].decode().splitlines(True),
                        fromfile=f"installed/{path}",
                        tofile=f"bundle/{path}",
                    )
                ),
                end="",
            )
    lock_digest = digest((root / "skills-lock.json").read_bytes())
    receipt_current = receipt is not None and receipt.get("bundleDigest") == lock_digest
    if apply and (changed or not receipt_current):
        # Stage complete directories before replacing any installed path.
        target.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=".repo-kit-stage-", dir=target) as stage_name:
            stage = Path(stage_name)
            for path, data in desired.items():
                dest = stage / path
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(data)
            # Preserve the old managed installation for recovery from I/O failure.
            recovery = target.resolve().parent / ".repo-kit-skill-backups" / lock_digest[:16]
            if recovery.exists():
                recovery = Path(tempfile.mkdtemp(prefix=lock_digest[:16] + "-", dir=recovery.parent))
            recovery.mkdir(parents=True, exist_ok=True)
            if receipt:
                shutil.copy2(receipt_path, recovery / RECEIPT)
            write_json(
                stage / RECEIPT,
                {
                    "schemaVersion": 1,
                    "skills": lock["skills"],
                    "files": lock["files"],
                    "bundleDigest": lock_digest,
                    "upstreamRevision": lock["upstream"]["revision"],
                },
            )
            names = [*lock["skills"], "mattpocock-LICENSE", RECEIPT]
            write_json(
                stage / INTERRUPTED,
                {
                    "schemaVersion": 1,
                    "recovery": recovery.name,
                    "before": {name: entry_hashes(target / name) for name in names},
                    "after": {name: entry_hashes(stage / name) for name in names},
                },
            )
            os.replace(stage / INTERRUPTED, target / INTERRUPTED)
            for name in [*lock["skills"], "mattpocock-LICENSE"]:
                dest = target / name
                if dest.exists():
                    os.replace(dest, recovery / name)
                os.replace(stage / name, dest)
            os.replace(stage / RECEIPT, receipt_path)
            (target / INTERRUPTED).unlink()
        print(f"Synchronized {len(lock['skills'])} skills; recovery: {recovery}")
    elif not changed and receipt_current:
        print("Installed bundle matches lock")
    elif not receipt_current:
        print("Installation receipt needs sync")
    return not changed and receipt_current


def refresh(root: Path, checkout: Path, revision: str) -> None:
    previous, content = bundle(root)
    actual_revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=checkout, text=True).strip()
    if not re.fullmatch(r"[a-f0-9]{40}", revision) or actual_revision != revision:
        raise ValueError("Pass the exact reviewed 40-character checkout revision")
    if subprocess.check_output(["git", "status", "--porcelain"], cwd=checkout):
        raise ValueError("Upstream checkout must be clean")
    source_paths = {}
    for name in UPSTREAM_SKILLS:
        matches = list((checkout / "skills").glob(f"*/{name}"))
        if len(matches) != 1:
            raise ValueError(f"Cannot resolve upstream skill: {name}")
        source_paths[name] = matches[0]

    # Resolve and inspect all upstream files before making any source changes.
    def tracked_content(path: str) -> dict[str, bytes]:
        entries = subprocess.check_output(["git", "ls-tree", "-rz", "--full-tree", revision, "--", path], cwd=checkout)
        result = {}
        for entry in entries.split(b"\0"):
            if not entry:
                continue
            info, filename = entry.decode().split("\t", 1)
            mode, kind, object_id = info.split()
            if kind != "blob" or mode not in {"100644", "100755"}:
                raise ValueError(f"Unsupported upstream entry: {filename}")
            result[filename] = subprocess.check_output(["git", "cat-file", "blob", object_id], cwd=checkout)
        return result

    upstream_content = {"mattpocock-LICENSE": tracked_content("LICENSE")["LICENSE"]}
    for name, source in source_paths.items():
        prefix = source.relative_to(checkout).as_posix() + "/"
        upstream_content.update(
            {f"{name}/{p.removeprefix(prefix)}": data for p, data in tracked_content(prefix).items()}
        )
    destination = root / "skills"
    adaptations = previous.get("adaptations", {})
    baseline = hashes(upstream_content)
    conflicts = [p for p in adaptations if baseline.get(p) != previous["upstream"]["files"][p]]
    if conflicts:
        raise ValueError("Upstream changed adapted files; reconcile before refresh: " + ", ".join(sorted(conflicts)))
    delivered = {**upstream_content, **{p: content[p] for p in adaptations}}
    local_content = {p: data for p, data in content.items() if p.split("/")[0] in LOCAL_SKILLS}
    validate_content({**local_content, **delivered})
    for name in UPSTREAM_SKILLS:
        if (destination / name).exists():
            shutil.rmtree(destination / name)
    for path, data in delivered.items():
        dest = destination / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
    write_json(
        root / "skills-lock.json",
        {
            "schemaVersion": 2,
            "skills": list(UPSTREAM_SKILLS + LOCAL_SKILLS),
            "adaptations": adaptations,
            "upstream": {
                "repository": "https://github.com/mattpocock/skills",
                "revision": revision,
                "paths": {name: p.relative_to(checkout).as_posix() for name, p in source_paths.items()},
                "files": baseline,
            },
            "files": hashes(files(destination)),
        },
    )
    print(f"Pinned upstream {revision}; review the Git diff before sync")


def relock(root: Path) -> None:
    lock = read_lock(root)
    content = files(root / "skills")
    validate_content(content)
    validate_upstream(lock, hashes(content))
    lock["schemaVersion"] = 2
    lock["files"] = hashes(content)
    write_json(root / "skills-lock.json", lock)
    print("Locked delivered skills; upstream baseline and declared adaptations verified")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("check", "diff", "sync", "lock", "refresh"))
    parser.add_argument("--installed-root", type=Path, default=Path.home() / ".agents/skills")
    parser.add_argument("--upstream-checkout", type=Path)
    parser.add_argument("--revision")
    parser.add_argument("--source-only", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "refresh":
            if args.upstream_checkout is None or args.revision is None:
                parser.error("refresh requires --upstream-checkout and --revision")
            refresh(ROOT, args.upstream_checkout, args.revision)
        elif args.command == "lock":
            relock(ROOT)
        elif args.source_only:
            if args.command != "check":
                parser.error("--source-only applies only to check")
            lock, _ = bundle(ROOT)
            print(f"Source bundle verified: {len(lock['skills'])} skills")
        else:
            current = sync(ROOT, args.installed_root, apply=args.command == "sync", show_diff=args.command == "diff")
            if args.command == "check" and not current:
                return 1
    except (OSError, ValueError, KeyError) as exc:
        parser.exit(1, f"skills: {exc}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
