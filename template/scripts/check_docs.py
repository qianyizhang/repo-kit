#!/usr/bin/env python3
"""Mechanical doc-governance checks (doctrine: docs/rules/governance.md).

The script is portable across repos: every repo-specific binding (paths,
authority docs, symlink map) lives in `pyproject.toml [tool.doc_governance]`.

Checks:
1. Valid frontmatter (description, scope, status, last_update).
2. Status matches folder location (docs under the deprecated dir must have
   status: deprecated, index README excluded).
3. Forbidden generated trailer tokens (e.g., </content>, </invoke>) are absent
   as standalone lines.
4. Local markdown file links point to existing files.
5. Backticked repo-relative path references in authority docs point to
   existing files/directories.
6. Skill manifests (SKILL.md under a skills dir) carry a semver `version:`.
7. Navigator-index coverage: every doc matching `index_required_globs` is
   referenced from `index_file`.
8. Agent-toolchain symlink layout matches `[tool.doc_governance.symlinks]`.
"""

import os
import re
import sys
import tomllib
from dataclasses import dataclass
from pathlib import Path

# Regex patterns
FRONTMATTER_START = re.compile(r"^---\s*$")
FRONTMATTER_KEY_VAL = re.compile(r"^([^:]+):\s*(.*)$")
FORBIDDEN_TOKENS = [re.compile(r"^</content>\s*$"), re.compile(r"^</invoke>\s*$")]
MARKDOWN_LINK_PATTERN = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
# SAMPLE: version: "1.3.1" → semver major.minor.patch, no pre-release tags
SEMVER_PATTERN = re.compile(r"^\d+\.\d+\.\d+$")


@dataclass(frozen=True)
class GovernanceConfig:
    exclude_dirs: frozenset[str]
    exclude_path_contains: tuple[str, ...]
    repo_path_dirs: tuple[str, ...]
    authority_files: frozenset[str]
    authority_globs: tuple[str, ...]
    skills_dirs: tuple[str, ...]
    deprecated_dir: str
    index_file: str
    index_required_globs: tuple[str, ...]
    symlinks: dict[str, str]

    @property
    def backtick_path_pattern(self) -> re.Pattern[str]:
        # SAMPLE: repo_path_dirs ["docs", ".codex"] → `((?:docs|\.codex)/[^`]+)`
        alternatives = "|".join(re.escape(d) for d in self.repo_path_dirs)
        return re.compile(rf"`((?:{alternatives})/[^`]+)`")


def load_config(repo_root: Path) -> GovernanceConfig:
    pyproject = repo_root / "pyproject.toml"
    try:
        raw = tomllib.loads(pyproject.read_text(encoding="utf-8")).get("tool", {}).get("doc_governance")
    except (OSError, tomllib.TOMLDecodeError) as e:
        sys.exit(f"check_docs: cannot read {pyproject}: {e}")
    if raw is None:
        sys.exit("check_docs: missing [tool.doc_governance] in pyproject.toml (see docs/rules/governance.md)")
    try:
        return GovernanceConfig(
            exclude_dirs=frozenset(raw["exclude_dirs"]),
            exclude_path_contains=tuple(raw.get("exclude_path_contains", [])),
            repo_path_dirs=tuple(raw["repo_path_dirs"]),
            authority_files=frozenset(raw["authority_files"]),
            authority_globs=tuple(raw["authority_globs"]),
            skills_dirs=tuple(raw["skills_dirs"]),
            deprecated_dir=raw["deprecated_dir"],
            index_file=raw["index_file"],
            index_required_globs=tuple(raw["index_required_globs"]),
            symlinks=dict(raw.get("symlinks", {})),
        )
    except KeyError as e:
        sys.exit(f"check_docs: [tool.doc_governance] missing required key {e}")


def glob_match(rel_path: str, pattern: str) -> bool:
    """Anchored glob where `*` does not cross `/` (fnmatch's does)."""
    # SAMPLE: "docs/*.md" matches "docs/mvp.md", not "docs/todo/backlog.md"
    regex = "".join("[^/]*" if c == "*" else "[^/]" if c == "?" else re.escape(c) for c in pattern)
    return re.fullmatch(regex, rel_path) is not None


def rel_posix(filepath: Path, repo_root: Path) -> str | None:
    try:
        return filepath.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        return None


def is_file_excluded(filepath: Path, repo_root: Path, cfg: GovernanceConfig) -> bool:
    rel = rel_posix(filepath, repo_root)
    if rel is None:
        return True
    if any(part in cfg.exclude_dirs for part in Path(rel).parts):
        return True
    if any(token in filepath.resolve().as_posix() for token in cfg.exclude_path_contains):
        return True
    # Inside a skills dir only the SKILL.md manifest is doc-governed; references/
    # examples/prompts under a skill are working material.
    if any(rel.startswith(f"{sd}/") for sd in cfg.skills_dirs) and filepath.name != "SKILL.md":
        return True
    return False


def get_markdown_files(repo_root: Path, cfg: GovernanceConfig) -> list[Path]:
    md_files = []
    for dirpath, dirnames, filenames in os.walk(repo_root):
        dirnames[:] = [d for d in dirnames if d not in cfg.exclude_dirs]
        for filename in filenames:
            if filename.endswith(".md"):
                filepath = Path(dirpath) / filename
                if not is_file_excluded(filepath, repo_root, cfg):
                    md_files.append(filepath)
    return md_files


def is_authority_doc(rel_path: str, cfg: GovernanceConfig) -> bool:
    """Limit bare-path validation to active authority docs where path drift is actionable."""
    return rel_path in cfg.authority_files or any(glob_match(rel_path, g) for g in cfg.authority_globs)


def is_skill_manifest(rel_path: str, cfg: GovernanceConfig) -> bool:
    return any(glob_match(rel_path, f"{sd}/*/SKILL.md") for sd in cfg.skills_dirs)


def parse_frontmatter(content: str) -> tuple[dict[str, str], int, str]:
    """Parse YAML-like frontmatter. Returns (parsed metadata, line offset after frontmatter, error message)."""
    lines = content.splitlines()
    if not lines:
        return {}, 0, "File is empty"

    if not FRONTMATTER_START.match(lines[0]):
        return {}, 0, "Missing frontmatter start marker (---)"

    metadata = {}
    end_line_idx = -1
    for idx, line in enumerate(lines[1:], start=1):
        if FRONTMATTER_START.match(line):
            end_line_idx = idx
            break
        match = FRONTMATTER_KEY_VAL.match(line)
        if match:
            key = match.group(1).strip()
            val = match.group(2).strip()
            if val.startswith(('"', "'")) and val.endswith(('"', "'")):
                val = val[1:-1]
            metadata[key] = val

    if end_line_idx == -1:
        return {}, 0, "Missing frontmatter end marker (---)"

    return metadata, end_line_idx + 1, ""


def check_file(filepath: Path, repo_root: Path, cfg: GovernanceConfig) -> tuple[list[str], bool]:
    """Run hygiene checks on a single markdown file. Returns (list of error strings, is_ignored)."""
    try:
        content = filepath.read_text(encoding="utf-8")
    except Exception as e:
        return [f"Failed to read file: {e}"], False

    lines = content.splitlines()
    for line in lines[:10]:
        line_strip = line.strip()
        if "doc-hygiene-disable" in line_strip or "doc-hygiene-ignore" in line_strip:
            if line_strip.startswith("#!") or line_strip.startswith("<!--") or line_strip.startswith("[//]:"):
                return [], True

    rel_path = rel_posix(filepath, repo_root) or filepath.as_posix()

    errors = []
    metadata, _, fm_err = parse_frontmatter(content)
    if fm_err:
        errors.append(f"Frontmatter: {fm_err}")
    else:
        required_keys = ["description", "scope", "status", "last_update"]
        for key in required_keys:
            if key not in metadata:
                errors.append(f"Frontmatter: Missing required key '{key}'")

        status = metadata.get("status")
        valid_statuses = {"experimental", "stable", "deprecated"}
        if status and status not in valid_statuses:
            errors.append(f"Frontmatter: Invalid status '{status}' (must be one of {valid_statuses})")

        is_deprecated_folder = rel_path.startswith(f"{cfg.deprecated_dir}/")
        is_deprecated_readme = is_deprecated_folder and filepath.name.lower() in ("readme.md", "readme")
        if is_deprecated_folder and not is_deprecated_readme and status != "deprecated":
            errors.append(f"Frontmatter: File in {cfg.deprecated_dir}/ but status is '{status}' (must be 'deprecated')")
        elif not is_deprecated_folder and status == "deprecated":
            errors.append(f"Frontmatter: Status is 'deprecated' but file is not in {cfg.deprecated_dir}/")

        if is_skill_manifest(rel_path, cfg):
            version = metadata.get("version")
            if not version:
                errors.append("Frontmatter: Skill manifest missing required key 'version'")
            elif not SEMVER_PATTERN.match(version):
                errors.append(f"Frontmatter: Skill version '{version}' is not semver (major.minor.patch)")

    for idx, line in enumerate(lines, 1):
        for token_pat in FORBIDDEN_TOKENS:
            if token_pat.match(line):
                errors.append(f"Line {idx}: Contains forbidden generated trailer token '{token_pat.pattern}'")

    check_backticks = is_authority_doc(rel_path, cfg)
    backtick_pattern = cfg.backtick_path_pattern
    for idx, line in enumerate(lines, start=1):
        for _, url in MARKDOWN_LINK_PATTERN.findall(line):
            clean_url = url.split("#")[0].split("?")[0]
            if not clean_url:
                continue

            if clean_url.startswith("file:///"):
                target_path = Path(clean_url.replace("file://", ""))
            elif clean_url.startswith(("http://", "https://", "mailto:", "javascript:")):
                continue
            else:
                target_path = (filepath.parent / clean_url).resolve()

            if not target_path.exists():
                if clean_url.startswith("/"):
                    target_path = (repo_root / clean_url.lstrip("/")).resolve()

                if not target_path.exists():
                    errors.append(f"Line {idx}: Broken local link to '{url}' (resolved to '{target_path}')")

        if check_backticks:
            for raw_path in backtick_pattern.findall(line):
                if any(token in raw_path for token in ("<", ">", "*", "{", "}", "...", "…")):
                    continue

                clean_path = re.split(r"[\s§#?:]", raw_path, maxsplit=1)[0]
                target_path = (repo_root / clean_path).resolve()
                try:
                    target_path.relative_to(repo_root.resolve())
                except ValueError:
                    errors.append(f"Line {idx}: Backticked repo path escapes repo: '{raw_path}'")
                    continue

                if not target_path.exists():
                    errors.append(f"Line {idx}: Broken backticked repo path '{raw_path}' (resolved to '{target_path}')")

    return errors, False


def check_symlink_layout(repo_root: Path, cfg: GovernanceConfig) -> list[str]:
    """Agent-toolchain layout: declared links exist, are symlinks, point at the declared relative target."""
    errors = []
    for link, expected_target in cfg.symlinks.items():
        link_path = repo_root / link
        if not link_path.is_symlink():
            if link_path.exists():
                errors.append(
                    f"Symlink layout: '{link}' exists but is a real path, not a symlink → '{expected_target}'"
                )
            else:
                errors.append(f"Symlink layout: '{link}' is missing (expected symlink → '{expected_target}')")
            continue
        actual_target = os.readlink(link_path)
        if actual_target != expected_target:
            errors.append(f"Symlink layout: '{link}' points to '{actual_target}', expected '{expected_target}'")
        elif not link_path.resolve().exists():
            errors.append(f"Symlink layout: '{link}' → '{expected_target}' is a broken link")
    return errors


def check_index_coverage(repo_root: Path, cfg: GovernanceConfig, md_files: list[Path]) -> list[str]:
    """Every doc matching index_required_globs must be referenced from the navigator index."""
    index_path = repo_root / cfg.index_file
    if not index_path.exists():
        return [f"Index coverage: navigator index '{cfg.index_file}' does not exist"]
    index_text = index_path.read_text(encoding="utf-8")
    index_dir = Path(cfg.index_file).parent.as_posix()

    errors = []
    for filepath in sorted(md_files):
        rel = rel_posix(filepath, repo_root)
        if rel is None or rel == cfg.index_file:
            continue
        if not any(glob_match(rel, g) for g in cfg.index_required_globs):
            continue
        rel_to_index = os.path.relpath(rel, start=index_dir) if index_dir != "." else rel
        if rel not in index_text and rel_to_index not in index_text:
            errors.append(f"Index coverage: '{rel}' is not referenced from '{cfg.index_file}'")
    return errors


def run(repo_root: Path, file_args: list[str] | None = None) -> int:
    cfg = load_config(repo_root)

    # Global checks run in both modes: they are cheap and guard repo-wide invariants.
    all_md_files = get_markdown_files(repo_root, cfg)
    global_errors = check_symlink_layout(repo_root, cfg) + check_index_coverage(repo_root, cfg, all_md_files)

    if file_args:
        md_files = []
        for arg in file_args:
            if arg.endswith(".md"):
                filepath = Path(arg).resolve()
                if not is_file_excluded(filepath, repo_root, cfg):
                    md_files.append(filepath)
    else:
        md_files = all_md_files

    total_errors = len(global_errors)
    checked_count = 0
    ignored_count = 0

    print(f"Scanning {len(md_files)} markdown files for hygiene violations...")
    for err in global_errors:
        print(f"[FAIL] {err}")

    for filepath in sorted(md_files):
        rel_path = filepath.relative_to(repo_root) if filepath.is_relative_to(repo_root) else filepath
        errors, ignored = check_file(filepath, repo_root, cfg)
        if ignored:
            ignored_count += 1
            print(f"Skipping ignored file: {rel_path}")
            continue

        checked_count += 1

        if errors:
            total_errors += len(errors)
            print(f"\n[FAIL] {rel_path}:")
            for err in errors:
                print(f"  - {err}")

    print("\n--- Summary ---")
    print(f"Files checked: {checked_count}")
    if ignored_count > 0:
        print(f"Files ignored: {ignored_count}")
    if total_errors > 0:
        print(f"Total violations found: {total_errors}")
        return 1
    print("All markdown files are clean and compliant.")
    return 0


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    return run(repo_root, sys.argv[1:])


if __name__ == "__main__":
    sys.exit(main())
