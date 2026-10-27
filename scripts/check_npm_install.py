#!/usr/bin/env python3
"""Gate outgoing commit tips on clean npm installs, without touching the checkout."""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path


def git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(root), *args])


def pushed_revisions(lines: str) -> list[str]:
    revisions = []
    for line in lines.splitlines():
        fields = line.split()
        if len(fields) != 4:
            raise ValueError("Expected Git pre-push ref updates on stdin")
        revision = fields[1]
        if not revision or any(c not in "0123456789abcdef" for c in revision):
            raise ValueError("Invalid outgoing object ID")
        if set(revision) != {"0"}:
            revisions.append(revision)
    return revisions


def toolchain_env(root: Path, checkout: Path, projects: list[Path], env: dict[str, str]) -> dict[str, str]:
    """Select an installed pair; never install tools or change shell defaults."""
    pin = checkout / ".nvmrc"
    # Revisions created before this gate gained a pin use the gate's own pin.
    if not pin.is_file():
        pin = root / ".nvmrc"
    if not pin.is_file():
        raise ValueError("Missing .nvmrc Node pin")
    node = pin.read_text().strip()
    if not re.fullmatch(r"\d+\.\d+\.\d+", node):
        raise ValueError(".nvmrc must pin an exact Node version (x.y.z)")
    managers = {
        manager
        for project in projects
        if (manager := json.loads((checkout / project / "package.json").read_text()).get("packageManager"))
    }
    if len(managers) != 1 or not re.fullmatch(r"npm@\d+\.\d+\.\d+", manager := next(iter(managers), "")):
        raise ValueError("npm packages must declare one shared exact npm@x.y.z packageManager pin")
    npm = manager.removeprefix("npm@")
    nvm = Path(env.get("NVM_DIR") or Path.home() / ".nvm")
    installed = nvm / "versions" / "node" / f"v{node}" / "bin"
    candidates = [env, {**env, "PATH": str(installed) + os.pathsep + env.get("PATH", "")}]
    observed = []
    for candidate in candidates:
        try:
            versions = [
                subprocess.check_output([command, "--version"], env=candidate, text=True, timeout=10).strip()
                for command in ("node", "npm")
            ]
        except (OSError, subprocess.SubprocessError) as exc:
            observed.append(str(exc))
            continue
        if versions == [f"v{node}", npm]:
            print(f"npm install gate: Node {node} · npm {npm}", flush=True)
            return candidate
        observed.append(f"Node {versions[0]} / npm {versions[1]}")
    raise ValueError(
        f"Need Node {node} / npm {npm}; checked PATH and {installed}: {'; '.join(observed)}. "
        f"Install once with `nvm install {node}` and `nvm exec {node} npm install --global npm@{npm}`, then retry."
    )


def check_revision(root: Path, commit: str) -> None:
    files = {
        Path(name.decode()) for name in git(root, "ls-tree", "-r", "--name-only", "-z", commit).split(b"\0") if name
    }
    projects = sorted(path.parent for path in files if path.name == "package.json")
    for project in projects:
        if project / "package-lock.json" not in files:
            raise ValueError(f"{project}: tracked npm package needs package-lock.json")
    if not projects:
        print(f"npm install gate: {commit[:12]} has no npm packages", flush=True)
        return
    with tempfile.TemporaryDirectory(prefix="repo-kit-npm-install-") as temp:
        scratch = Path(temp)
        checkout = scratch / "checkout"
        checkout.mkdir()
        with tarfile.open(fileobj=io.BytesIO(git(root, "archive", commit))) as archive:
            archive.extractall(checkout, filter="data")
        env = os.environ.copy()
        # Git exports repository-local variables to hooks. Lifecycle scripts must
        # not inherit a pointer back to the user's checkout or alternate index.
        for key in git(root, "rev-parse", "--local-env-vars").decode().splitlines():
            env.pop(key, None)
        env = toolchain_env(root, checkout, projects, env)
        for index, project in enumerate(projects):
            # A shared content-addressed cache could hide a bad URL in a later package.
            cache = scratch / f"cache-{index}"
            print(f"npm install gate: {commit[:12]} · {project} · empty cache", flush=True)
            subprocess.run(
                ["npm", "ci", "--cache", str(cache), "--engine-strict", "--no-audit", "--no-fund"],
                cwd=checkout / project,
                env=env,
                check=True,
                timeout=600,
            )
    print(f"npm install gate: {commit[:12]} passed ({len(projects)} packages)", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", action="append", help="Committed candidate; otherwise read Git pre-push stdin")
    args = parser.parse_args()
    try:
        root = Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip())
        revisions = args.revision if args.revision is not None else pushed_revisions(sys.stdin.read())
        checked = set()
        for revision in revisions:
            commit = git(root, "rev-parse", "--verify", "--end-of-options", f"{revision}^{{commit}}").decode().strip()
            if commit not in checked:
                check_revision(root, commit)
                checked.add(commit)
    except (OSError, ValueError, tarfile.TarError, subprocess.SubprocessError) as exc:
        parser.exit(1, f"npm install gate failed; push blocked: {exc}\n")


if __name__ == "__main__":
    main()
