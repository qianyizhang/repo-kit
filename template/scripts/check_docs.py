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
7. Document classes are declared, configured, complete, and location-valid.
8. Navigator routability: every configured area exists and is routed from the
   compact `index_file` (complete discovery belongs to generated Human View).
9. Agent-toolchain symlink layout matches `[tool.doc_governance.symlinks]`.
10. Backlog-item records have valid identity, lifecycle, lineage, and ledger
   structure.
11. Claude and Codex explicit-only skill invocation policies agree.
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
WORK_ID_PATTERN = re.compile(r"^AB-[A-Z0-9]+-\d{3}$")
WORK_STATUSES = {"deferred", "ready", "wip", "blocked", "done", "partial", "canceled"}
WORK_KINDS = {"decision", "build", "research"}
BACKLOG_ITEM_DIR = "records/work-items/items"
BACKLOG_REQUIRED_HEADINGS = (
    "## Intent",
    "## Acceptance Criteria",
    "## Context and Trade-offs",
    "## Status History",
    "## Implementation Ledger",
)


@dataclass(frozen=True)
class DocumentClassProfile:
    required_fields: tuple[str, ...]
    allowed_prefixes: tuple[str, ...]
    allowed_paths: frozenset[str]


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
    index_route_areas: tuple[str, ...]
    document_classes: dict[str, DocumentClassProfile]
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
            index_route_areas=tuple(raw["index_route_areas"]),
            document_classes={
                name: DocumentClassProfile(
                    required_fields=tuple(profile.get("required_fields", [])),
                    allowed_prefixes=tuple(profile.get("allowed_prefixes", [])),
                    allowed_paths=frozenset(profile.get("allowed_paths", [])),
                )
                for name, profile in raw["document_classes"].items()
            },
            symlinks=dict(raw.get("symlinks", {})),
        )
    except KeyError as e:
        sys.exit(f"check_docs: [tool.doc_governance] missing required key {e}")


def glob_match(rel_path: str, pattern: str) -> bool:
    """Anchored glob where `*` does not cross `/` (fnmatch's does)."""
    # SAMPLE: "docs/*.md" matches "docs/mvp.md", not "records/work-items/backlog.md"
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


def is_backlog_item(rel_path: str) -> bool:
    path = Path(rel_path)
    return path.parent.as_posix() == BACKLOG_ITEM_DIR and path.suffix == ".md"


def markdown_section(content: str, heading: str) -> str:
    """Return the body below an exact H2 heading up to the next H2."""
    match = re.search(rf"^{re.escape(heading)}\s*$", content, re.MULTILINE)
    if match is None:
        return ""
    tail = content[match.end() :]
    next_heading = re.search(r"^##\s+", tail, re.MULTILINE)
    return tail[: next_heading.start()] if next_heading else tail


def metadata_work_ids(value: str) -> set[str]:
    """Extract work IDs from a compact frontmatter value such as `AB-X-001, AB-X-002`."""
    return set(re.findall(r"\bAB-[A-Z0-9]+-\d{3}\b", value))


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


def check_document_class(rel_path: str, metadata: dict[str, str], cfg: GovernanceConfig) -> list[str]:
    """Validate the declared class profile and its repository-owned location."""
    class_name = metadata.get("document_class", "")
    if not class_name:
        return ["Frontmatter: Missing required key 'document_class'"]
    profile = cfg.document_classes.get(class_name)
    if profile is None:
        return [f"Frontmatter: Undeclared document_class '{class_name}'"]
    errors = [
        f"Frontmatter: Class '{class_name}' missing required key '{key}'"
        for key in profile.required_fields
        if not metadata.get(key)
    ]
    if rel_path not in profile.allowed_paths and not any(
        rel_path.startswith(prefix) for prefix in profile.allowed_prefixes
    ):
        errors.append(f"Frontmatter: Class '{class_name}' is not allowed at '{rel_path}'")
    if class_name == "report":
        outcome = metadata.get("report_outcome", "")
        allowed_outcomes = {"promoted", "inconclusive", "archive_eligible"}
        if outcome not in allowed_outcomes:
            errors.append(f"Frontmatter: Report has invalid report_outcome '{outcome}'")
        if outcome == "inconclusive":
            for key in ("inconclusive_reason", "review_trigger"):
                if not metadata.get(key):
                    errors.append(f"Frontmatter: Inconclusive report missing required key '{key}'")
        if outcome == "archive_eligible":
            for key in ("archive_id", "promoted_destinations"):
                if not metadata.get(key):
                    errors.append(f"Frontmatter: Archive-eligible report missing required key '{key}'")
    return errors


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
        errors.extend(check_document_class(rel_path, metadata, cfg))

        status = metadata.get("status")
        valid_statuses = {"experimental", "stable", "deprecated"}
        if status and status not in valid_statuses:
            errors.append(f"Frontmatter: Invalid status '{status}' (must be one of {valid_statuses})")

        is_deprecated_folder = rel_path.startswith(f"{cfg.deprecated_dir}/")
        is_deprecated_readme = is_deprecated_folder and filepath.name.lower() in (
            "readme.md",
            "readme",
        )
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


def check_index_routes(repo_root: Path, cfg: GovernanceConfig) -> list[str]:
    """The compact navigator routes configured areas; it does not enumerate files."""
    index_path = repo_root / cfg.index_file
    if not index_path.exists():
        return [f"Index coverage: navigator index '{cfg.index_file}' does not exist"]
    index_text = index_path.read_text(encoding="utf-8")
    index_dir = Path(cfg.index_file).parent.as_posix()

    errors = []
    for area in cfg.index_route_areas:
        if not (repo_root / area).exists():
            errors.append(f"Index routes: configured area '{area}' does not exist")
            continue
        normalized = area.rstrip("/")
        rel_to_index = os.path.relpath(normalized, start=index_dir) if index_dir != "." else normalized
        if area not in index_text and normalized not in index_text and rel_to_index not in index_text:
            errors.append(f"Index routes: area '{area}' is not routed from '{cfg.index_file}'")
    return errors


def check_skill_invocation_policies(repo_root: Path, cfg: GovernanceConfig, md_files: list[Path]) -> list[str]:
    """Keep Claude and Codex explicit-only skill metadata synchronized."""
    errors = []
    for filepath in sorted(md_files):
        rel = rel_posix(filepath, repo_root)
        if rel is None or not is_skill_manifest(rel, cfg):
            continue
        metadata, _, fm_err = parse_frontmatter(filepath.read_text(encoding="utf-8"))
        if fm_err:
            continue

        claude_value = metadata.get("disable-model-invocation", "false").lower()
        if claude_value not in {"true", "false"}:
            errors.append(f"Skill invocation: '{rel}' has invalid disable-model-invocation value '{claude_value}'")
            continue
        claude_explicit_only = claude_value == "true"

        openai_path = filepath.parent / "agents/openai.yaml"
        openai_text = openai_path.read_text(encoding="utf-8") if openai_path.exists() else ""
        policy_match = re.search(
            r"^\s*allow_implicit_invocation:\s*(true|false)\s*$",
            openai_text,
            re.MULTILINE,
        )
        codex_explicit_only = policy_match is not None and policy_match.group(1) == "false"
        if claude_explicit_only != codex_explicit_only:
            openai_rel = rel_posix(openai_path, repo_root) or openai_path.as_posix()
            errors.append(
                f"Skill invocation: '{rel}' and '{openai_rel}' disagree; explicit-only "
                "skills require disable-model-invocation: true and "
                "policy.allow_implicit_invocation: false"
            )
    return errors


def check_backlog_items(repo_root: Path, md_files: list[Path]) -> list[str]:
    """Validate durable one-file-per-item backlog records and their lineage."""
    records: dict[str, tuple[Path, dict[str, str], str]] = {}
    errors = []

    for filepath in sorted(md_files):
        rel = rel_posix(filepath, repo_root)
        if rel is None or not is_backlog_item(rel):
            continue
        content = filepath.read_text(encoding="utf-8")
        metadata, _, fm_err = parse_frontmatter(content)
        if fm_err:
            continue  # check_file reports the frontmatter failure

        for key in (
            "work_id",
            "work_status",
            "work_kind",
            "added",
            "tags",
            "depends_on",
            "residual_of",
            "residual_items",
        ):
            if not metadata.get(key):
                errors.append(f"Backlog item: '{rel}' is missing frontmatter key '{key}'")

        work_id = metadata.get("work_id", "")
        if work_id and not WORK_ID_PATTERN.fullmatch(work_id):
            errors.append(f"Backlog item: '{rel}' has invalid work_id '{work_id}'")
        if work_id and not filepath.stem.startswith(f"{work_id}-"):
            errors.append(f"Backlog item: filename '{filepath.name}' must start with '{work_id}-'")
        if work_id in records:
            other = rel_posix(records[work_id][0], repo_root)
            errors.append(f"Backlog item: duplicate work_id '{work_id}' in '{other}' and '{rel}'")
        elif work_id:
            records[work_id] = (filepath, metadata, content)

        work_status = metadata.get("work_status", "")
        if work_status and work_status not in WORK_STATUSES:
            errors.append(
                f"Backlog item: '{rel}' has invalid work_status '{work_status}' "
                f"(must be one of {sorted(WORK_STATUSES)})"
            )

        work_kind = metadata.get("work_kind", "")
        if work_kind and work_kind not in WORK_KINDS:
            errors.append(
                f"Backlog item: '{rel}' has invalid work_kind '{work_kind}' (must be one of {sorted(WORK_KINDS)})"
            )

        for heading in BACKLOG_REQUIRED_HEADINGS:
            if not re.search(rf"^{re.escape(heading)}\s*$", content, re.MULTILINE):
                errors.append(f"Backlog item: '{rel}' is missing required heading '{heading}'")

        status_history = markdown_section(content, "## Status History")
        if work_status and not re.search(
            rf"^\|[^|\n]*\|[^|\n]*\|[^|\n]*\|\s*{re.escape(work_status)}\s*\|",
            status_history,
            re.MULTILINE,
        ):
            errors.append(f"Backlog item: '{rel}' has no Status History transition to current status '{work_status}'")

        implementation_ledger = markdown_section(content, "## Implementation Ledger")
        if work_status in {"wip", "blocked", "done", "partial"} and (
            not implementation_ledger.strip() or "No implementation events yet." in implementation_ledger
        ):
            errors.append(f"Backlog item: '{rel}' status '{work_status}' requires an Implementation Ledger event")

        acceptance = markdown_section(content, "## Acceptance Criteria")
        if work_status == "done" and re.search(r"^\s*[-*]\s+\[ \]", acceptance, re.MULTILINE):
            errors.append(f"Backlog item: '{rel}' is done but has unchecked acceptance criteria")

        if work_status == "partial" and not metadata_work_ids(metadata.get("residual_items", "")):
            errors.append(f"Backlog item: '{rel}' is partial but has no residual_items work ID")

    known_ids = set(records)
    for work_id, (filepath, metadata, _) in records.items():
        rel = rel_posix(filepath, repo_root)
        for key in ("depends_on", "residual_of", "residual_items"):
            for linked_id in metadata_work_ids(metadata.get(key, "")):
                if linked_id not in known_ids:
                    errors.append(f"Backlog item: '{rel}' {key} references missing work item '{linked_id}'")
                elif linked_id == work_id:
                    errors.append(f"Backlog item: '{rel}' {key} cannot reference itself")

    return errors


def run(repo_root: Path, file_args: list[str] | None = None) -> int:
    cfg = load_config(repo_root)

    # Global checks run in both modes: they are cheap and guard repo-wide invariants.
    all_md_files = get_markdown_files(repo_root, cfg)
    global_errors = (
        check_symlink_layout(repo_root, cfg)
        + check_index_routes(repo_root, cfg)
        + check_skill_invocation_policies(repo_root, cfg, all_md_files)
        + check_backlog_items(repo_root, all_md_files)
    )

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
