#!/usr/bin/env python3
"""Read-only survey of repo-kit branches, worktrees, and Copier consumers."""

from __future__ import annotations

import argparse
import datetime as dt
import fnmatch
import subprocess
from dataclasses import dataclass
from pathlib import Path


def git(repo: Path, *args: str, text: bool = True) -> str | bytes:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=text,
    )
    return result.stdout


def git_text(repo: Path, *args: str) -> str:
    value = git(repo, *args)
    assert isinstance(value, str)
    return value.strip()


def git_bytes(repo: Path, *args: str) -> bytes:
    value = git(repo, *args, text=False)
    assert isinstance(value, bytes)
    return value


def answer_value(path: Path, key: str) -> str | None:
    prefix = f"{key}:"
    for line in path.read_text().splitlines():
        if line.startswith(prefix):
            return line.split(":", 1)[1].strip().strip("'\"")
    return None


def skip_patterns(copier_text: str) -> list[str]:
    patterns: list[str] = []
    active = False
    for line in copier_text.splitlines():
        if line.startswith("_skip_if_exists:"):
            active = True
            continue
        if active and line and not line[0].isspace():
            break
        if active and line.lstrip().startswith("- "):
            patterns.append(line.lstrip()[2:].strip().strip("'\""))
    return patterns


def is_skipped(path: str, patterns: list[str]) -> bool:
    for pattern in patterns:
        if pattern.endswith("/**") and (path == pattern[:-3] or path.startswith(pattern[:-2])):
            return True
        if fnmatch.fnmatchcase(path, pattern):
            return True
    return False


def output_path(source_path: str) -> str:
    relative = source_path.removeprefix("template/")
    return relative.removesuffix(".jinja")


def changed_from_blob(repo: Path, ref: str, source: str, target: Path) -> bool:
    if not target.is_file():
        return True
    return git_bytes(repo, "show", f"{ref}:{source}") != target.read_bytes()


@dataclass(frozen=True)
class Worktree:
    path: Path
    branch: str | None


def worktrees(repo: Path) -> list[Worktree]:
    items: list[Worktree] = []
    current: dict[str, str] = {}
    raw = git_text(repo, "worktree", "list", "--porcelain")
    for line in [*raw.splitlines(), ""]:
        if not line:
            if current:
                branch = current.get("branch")
                items.append(
                    Worktree(
                        Path(current["worktree"]),
                        branch.removeprefix("refs/heads/") if branch else None,
                    )
                )
                current = {}
            continue
        key, _, value = line.partition(" ")
        current[key] = value
    return items


def relation(repo: Path, base: str, branch: str) -> tuple[int, int]:
    raw = git_text(repo, "rev-list", "--left-right", "--count", f"{base}...{branch}")
    behind, ahead = raw.split()
    return int(behind), int(ahead)


def action_for(branch: str, base: str, behind: int, ahead: int) -> str:
    if branch == base:
        return "keep base"
    if ahead == 0:
        return "retire candidate"
    if behind == 0:
        return "fast-forward candidate"
    return "intent review required"


def survey_branches(repo: Path, base: str) -> None:
    print("## Local branches and worktrees\n")
    print("| Branch | Behind | Ahead | Worktree | Dirty | Candidate action |")
    print("| --- | ---: | ---: | --- | --- | --- |")
    tree_by_branch = {item.branch: item.path for item in worktrees(repo)}
    branches = git_text(repo, "for-each-ref", "--format=%(refname:short)", "refs/heads").splitlines()
    for branch in sorted(branches):
        behind, ahead = relation(repo, base, branch)
        tree = tree_by_branch.get(branch)
        dirty = "—"
        if tree:
            dirty = "yes" if git_text(tree, "status", "--porcelain=v1") else "no"
        print(f"| `{branch}` | {behind} | {ahead} | `{tree}` | {dirty} | {action_for(branch, base, behind, ahead)} |")
    print()


def tracked_template_files(repo: Path, ref: str) -> list[str]:
    raw = git_text(repo, "ls-tree", "-r", "--name-only", ref, "--", "template")
    return [path for path in raw.splitlines() if path]


def format_paths(paths: list[str]) -> str:
    return ", ".join(f"`{path}`" for path in paths) if paths else "none"


def survey_consumer(repo: Path, consumer: Path) -> None:
    answers = consumer / ".copier-answers.yml"
    baseline = answer_value(answers, "_commit")
    if not baseline:
        print(f"### {consumer.name}\n\nMissing `_commit`; stop and repair provenance.\n")
        return
    try:
        copier_at_baseline = git_text(repo, "show", f"{baseline}:copier.yml")
    except subprocess.CalledProcessError:
        print(f"### {consumer.name}\n\nBaseline `{baseline}` is unavailable locally.\n")
        return

    patterns = skip_patterns(copier_at_baseline)
    managed_delta: list[str] = []
    seeded_absorbed: list[str] = []
    seeded_review: list[str] = []
    for source in tracked_template_files(repo, baseline):
        if source.endswith(".jinja"):
            continue
        output = output_path(source)
        if changed_from_blob(repo, baseline, source, consumer / output):
            if not is_skipped(output, patterns):
                managed_delta.append(output)
                continue
            current_source = repo / source
            consumer_target = consumer / output
            if (
                current_source.is_file()
                and consumer_target.is_file()
                and current_source.read_bytes() == consumer_target.read_bytes()
            ):
                seeded_absorbed.append(output)
            else:
                seeded_review.append(output)

    current_drift: list[str] = []
    current_patterns = skip_patterns((repo / "copier.yml").read_text())
    for source in tracked_template_files(repo, "HEAD"):
        if source.endswith(".jinja"):
            continue
        output = output_path(source)
        if is_skipped(output, current_patterns):
            continue
        source_file = repo / source
        target_file = consumer / output
        if not target_file.is_file() or source_file.read_bytes() != target_file.read_bytes():
            current_drift.append(output)

    known_skills = {
        output_path(path).split("/")[2]
        for ref in (baseline, "HEAD")
        for path in tracked_template_files(repo, ref)
        if path.startswith("template/.codex/skills/")
    }
    consumer_skill_root = consumer / ".codex/skills"
    consumer_skills = (
        {path.name for path in consumer_skill_root.iterdir() if path.is_dir()}
        if consumer_skill_root.is_dir()
        else set()
    )
    extra_skills = sorted(consumer_skills - known_skills)
    dirty = bool(git_text(consumer, "status", "--porcelain=v1"))

    print(f"### {consumer.name}\n")
    print(f"- Baseline: `{baseline}`")
    print(f"- Worktree dirty: `{'yes' if dirty else 'no'}`")
    print(f"- Managed deltas from baseline: {format_paths(managed_delta)}")
    print(f"- Seeded deltas already absorbed: {format_paths(seeded_absorbed)}")
    print(f"- Seeded/local deltas needing review: {format_paths(seeded_review)}")
    print(f"- Current managed drift: {format_paths(current_drift)}")
    print(f"- Consumer-only skills: {format_paths(extra_skills)}")
    print()


def consumers(repo: Path, parent: Path) -> list[Path]:
    found: list[Path] = []
    for answers in parent.glob("*/.copier-answers.yml"):
        source = answer_value(answers, "_src_path")
        if source and Path(source).expanduser().resolve() == repo:
            found.append(answers.parent.resolve())
    return sorted(found)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--base", default="main")
    parser.add_argument("--consumer-parent", type=Path)
    args = parser.parse_args()

    repo = Path(git_text(args.repo.resolve(), "rev-parse", "--show-toplevel"))
    parent = (args.consumer_parent or repo.parent).expanduser().resolve()
    timestamp = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    head = git_text(repo, "rev-parse", "--short=12", "HEAD")

    print("# repo-kit governance survey\n")
    print(f"- Generated: `{timestamp}`")
    print(f"- Repository: `{repo}`")
    print(f"- HEAD: `{head}`")
    print(f"- Base: `{args.base}`")
    print("- Mode: read-only\n")
    survey_branches(repo, args.base)

    print("## Copier consumers\n")
    discovered = consumers(repo, parent)
    if not discovered:
        print("No consumers found.\n")
    for consumer in discovered:
        survey_consumer(repo, consumer)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
