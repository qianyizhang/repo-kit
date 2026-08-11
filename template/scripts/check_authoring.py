#!/usr/bin/env python3
"""Profile-scoped, non-mutating technical-authoring checks.

Portable rule behavior lives here. Consumer languages, glossary paths, target
files/sections, and blocking rule IDs live in ``[tool.authoring_check]``.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tomllib
from dataclasses import asdict, dataclass
from pathlib import Path

HEADING_RE = re.compile(r"^##\s+(.+?)\s*$")
ASCII_WORD = r"A-Za-z0-9_"

DISCOURAGED_MODALITY = {
    "en": (
        (
            re.compile(r"\bneed(?:s)? to\b", re.IGNORECASE),
            "use a configured must/should/may level",
        ),
        (
            re.compile(r"\bhave to\b", re.IGNORECASE),
            "use must when the statement is mandatory",
        ),
        (re.compile(r"\bought to\b", re.IGNORECASE), "use should for a recommendation"),
    ),
    "zh": (
        (re.compile(r"需要"), "明确使用 必须、应 或 可以"),
        (re.compile(r"最好"), "明确使用 应 或 可以"),
        (re.compile(r"尽量"), "说明可验证的要求或保留为人工判断"),
    ),
}
PASSIVE_INSTRUCTION = {
    "en": re.compile(
        r"^(?:the\s+)?(?:file|document|artifact|record|result|output)\s+"
        r"(?:must|should|may) be\s+[A-Za-z]+(?:ed|en)\b",
        re.IGNORECASE,
    ),
    "zh": re.compile(r"^(?:文件|文档|制品|记录|结果|输出)(?:必须|应|可以)被"),
}
ACTION_START = {
    "en": re.compile(
        r"^(?:add|create|update|remove|run|check|verify|write|read|move|set|record|return|use|keep|preserve)\b",
        re.IGNORECASE,
    ),
    "zh": re.compile(r"^(?:添加|创建|更新|删除|运行|检查|验证|编写|读取|移动|设置|记录|返回|使用|保留)"),
}
MULTI_ACTION = {
    "en": re.compile(
        r"\b(?:add|create|update|remove|run|check|verify|write|read|move|set|record|return|use|keep|preserve)\b"
        r".+\b(?:and|then)\b.+\b"
        r"(?:add|create|update|remove|run|check|verify|write|read|move|set|record|return|use|keep|preserve)\b",
        re.IGNORECASE,
    ),
    "zh": re.compile(
        r"(?:添加|创建|更新|删除|运行|检查|验证|编写|读取|移动|设置|记录|返回|使用|保留).*(?:并且|然后|再).*(?:添加|创建|更新|删除|运行|检查|验证|编写|读取|移动|设置|记录|返回|使用|保留)"
    ),
}
TRAILING_CONDITION = {
    "en": re.compile(r"^.+\b(?:if|when|unless|after|before)\b.+[.!?]?$", re.IGNORECASE),
    "zh": re.compile(r"^.+[\uFF0C,](?:如果|当|除非|在).+[\u3002\uFF01\uFF1F]?$"),
}


@dataclass(frozen=True)
class Target:
    glob: str
    profile: str
    sections: tuple[str, ...] = ()


@dataclass(frozen=True)
class Config:
    mode: str
    languages: tuple[str, ...]
    glossary_globs: tuple[str, ...]
    blocking_rule_ids: frozenset[str]
    targets: tuple[Target, ...]


@dataclass(frozen=True)
class Finding:
    rule_id: str
    severity: str
    file: str
    line: int
    profile: str
    message: str
    authority_source: str
    suggested_replacement: str | None = None


def load_config(repo_root: Path, config_path: Path | None = None) -> Config:
    path = config_path or repo_root / "pyproject.toml"
    try:
        raw = tomllib.loads(path.read_text(encoding="utf-8"))["tool"]["authoring_check"]
    except (OSError, KeyError, tomllib.TOMLDecodeError) as exc:
        raise ValueError(f"cannot load [tool.authoring_check] from {path}: {exc}") from exc
    mode = str(raw.get("mode", "advisory"))
    if mode not in {"advisory", "enforcing"}:
        raise ValueError("authoring_check.mode must be advisory or enforcing")
    targets = tuple(
        Target(
            glob=str(item["glob"]),
            profile=str(item.get("profile", "technical")),
            sections=tuple(str(section) for section in item.get("sections", [])),
        )
        for item in raw.get("targets", [])
    )
    if not targets:
        raise ValueError("authoring_check needs at least one [[tool.authoring_check.targets]]")
    return Config(
        mode=mode,
        languages=tuple(str(value) for value in raw.get("languages", ["en"])),
        glossary_globs=tuple(str(value) for value in raw.get("glossary_globs", [])),
        blocking_rule_ids=frozenset(str(value) for value in raw.get("blocking_rule_ids", [])),
        targets=targets,
    )


def _split_row(line: str) -> list[str]:
    value = line.strip().strip("|")
    return [cell.strip() for cell in value.split("|")]


def _strip_ticks(value: str) -> str:
    value = value.strip()
    return value[1:-1].strip() if len(value) > 1 and value.startswith("`") and value.endswith("`") else value


def _split_terms(value: str) -> tuple[str, ...]:
    if not value or value.strip() in {"\u2014", "-", "\u2013", "N/A", "n/a"}:
        return ()
    return tuple(token for part in re.split(r"[,;/]|\s+or\s+", value) if (token := _strip_ticks(part.strip())))


def _is_table_separator(line: str) -> bool:
    remainder = line.replace("|", "").replace(":", "").replace("-", "").strip()
    return not remainder


def _glossary_terms(repo_root: Path, config: Config) -> tuple[dict[str, set[tuple[str, str]]], set[str]]:
    avoid: dict[str, set[tuple[str, str]]] = {}
    canonical: set[str] = set()
    for pattern in config.glossary_globs:
        for path in sorted(repo_root.glob(pattern)):
            if not path.is_file():
                continue
            lines = path.read_text(encoding="utf-8").splitlines()
            index = 0
            while index < len(lines):
                if not lines[index].lstrip().startswith("|"):
                    index += 1
                    continue
                rows: list[str] = []
                while index < len(lines) and lines[index].lstrip().startswith("|"):
                    rows.append(lines[index])
                    index += 1
                if len(rows) < 2:
                    continue
                headers = [re.sub(r"\s+", " ", cell.lower().replace("`", "")).strip() for cell in _split_row(rows[0])]
                term_col = next(
                    (i for i, value in enumerate(headers) if value in {"term", "terms"}),
                    None,
                )
                avoid_col = next((i for i, value in enumerate(headers) if "avoid" in value), None)
                if term_col is None:
                    continue
                start = 2 if _is_table_separator(rows[1]) else 1
                for row in rows[start:]:
                    cells = _split_row(row)
                    if term_col >= len(cells):
                        continue
                    term = _strip_ticks(cells[term_col])
                    if not term:
                        continue
                    canonical.add(term.casefold())
                    raw_values = []
                    if avoid_col is not None and avoid_col < len(cells):
                        raw_values.extend(_split_terms(cells[avoid_col]))
                    authority = path.relative_to(repo_root).as_posix()
                    for raw in raw_values:
                        if raw.casefold() != term.casefold():
                            avoid.setdefault(raw.casefold(), set()).add((term, authority))
    return avoid, canonical


def _selected_lines(path: Path, sections: tuple[str, ...]) -> list[tuple[int, str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    frontmatter_end = 0
    if lines and lines[0].strip() == "---":
        frontmatter_end = next(
            (line_number for line_number, line in enumerate(lines[1:], 2) if line.strip() == "---"),
            len(lines),
        )
    if not sections:
        selected = list(enumerate(lines, 1))
    else:
        wanted = {section.casefold() for section in sections}
        active = False
        selected = []
        for line_number, line in enumerate(lines, 1):
            heading = HEADING_RE.match(line)
            if heading:
                active = heading.group(1).strip().casefold() in wanted
                continue
            if active:
                selected.append((line_number, line))

    prose: list[tuple[int, str]] = []
    in_fence = False
    for line_number, line in selected:
        stripped = line.strip()
        if line_number <= frontmatter_end:
            continue
        if stripped.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence or not stripped or stripped.startswith(("#", "|", "<!--")):
            continue
        cleaned = re.sub(r"^\s*(?:[-*+] |\d+[.)]\s+)", "", line).strip()
        cleaned = cleaned.replace("**", "").replace("__", "")
        for sentence in re.split(r"(?<=[.!?\u3002\uFF01\uFF1F])\s+", cleaned):
            if sentence:
                prose.append((line_number, sentence))
    return prose


def _contains_phrase(text: str, phrase: str) -> bool:
    if re.search(r"[\u3400-\u9fff]", phrase) or " " in phrase or "-" in phrase or "/" in phrase:
        return phrase.casefold() in text.casefold()
    return (
        re.search(
            rf"(?<![{ASCII_WORD}]){re.escape(phrase)}(?![{ASCII_WORD}])",
            text,
            re.IGNORECASE,
        )
        is not None
    )


def _severity(config: Config, rule_id: str) -> str:
    if config.mode == "enforcing" and rule_id in config.blocking_rule_ids:
        return "error"
    return "advisory"


def _findings_for_line(
    *,
    config: Config,
    relative_path: str,
    profile: str,
    line_number: int,
    text: str,
    avoid: dict[str, set[tuple[str, str]]],
    canonical: set[str],
) -> list[Finding]:
    findings: list[Finding] = []
    for token, destinations in sorted(avoid.items(), key=lambda item: len(item[0]), reverse=True):
        if token in canonical or not _contains_phrase(text, token):
            continue
        terms = sorted({term for term, _ in destinations})
        authorities = sorted({authority for _, authority in destinations})
        suggestion = terms[0] if len(terms) == 1 else None
        message = (
            f"Prefer canonical term {suggestion!r} over {token!r}."
            if suggestion
            else f"Term {token!r} maps to multiple canonical terms; review without automatic replacement."
        )
        findings.append(
            Finding(
                rule_id="TERM001",
                severity=_severity(config, "TERM001"),
                file=relative_path,
                line=line_number,
                profile=profile,
                message=message,
                authority_source=", ".join(authorities),
                suggested_replacement=suggestion,
            )
        )
    for language in config.languages:
        for pattern, suggestion in DISCOURAGED_MODALITY.get(language, ()):
            if pattern.search(text):
                findings.append(
                    Finding(
                        rule_id="MODAL001",
                        severity=_severity(config, "MODAL001"),
                        file=relative_path,
                        line=line_number,
                        profile=profile,
                        message=f"Use controlled modality: {suggestion}.",
                        authority_source="docs/rules/authoring.md",
                    )
                )
                break
        passive = PASSIVE_INSTRUCTION.get(language)
        if passive and passive.search(text):
            findings.append(
                Finding(
                    rule_id="ACTOR001",
                    severity=_severity(config, "ACTOR001"),
                    file=relative_path,
                    line=line_number,
                    profile=profile,
                    message="State the responsible actor or use a direct instruction.",
                    authority_source="docs/rules/authoring.md",
                )
            )
        multiple = MULTI_ACTION.get(language)
        if multiple and multiple.search(text):
            findings.append(
                Finding(
                    rule_id="ACTION001",
                    severity=_severity(config, "ACTION001"),
                    file=relative_path,
                    line=line_number,
                    profile=profile,
                    message="Review whether this sentence contains more than one independent action.",
                    authority_source="docs/rules/authoring.md",
                )
            )
        condition = TRAILING_CONDITION.get(language)
        action_start = ACTION_START.get(language)
        if (
            condition
            and action_start
            and action_start.search(text)
            and condition.search(text)
            and not re.match(r"^(?:if|when|unless|after|before)\b", text, re.IGNORECASE)
        ):
            findings.append(
                Finding(
                    rule_id="COND001",
                    severity=_severity(config, "COND001"),
                    file=relative_path,
                    line=line_number,
                    profile=profile,
                    message="Put a prerequisite condition before the dependent action when execution order matters.",
                    authority_source="docs/rules/authoring.md",
                )
            )
    return findings


def check_repository(repo_root: Path, config: Config) -> list[Finding]:
    avoid, canonical = _glossary_terms(repo_root, config)
    findings: list[Finding] = []
    seen: set[tuple[str, str, tuple[str, ...]]] = set()
    for target in config.targets:
        for path in sorted(repo_root.glob(target.glob)):
            if not path.is_file():
                continue
            relative = path.relative_to(repo_root).as_posix()
            identity = (relative, target.profile, target.sections)
            if identity in seen:
                continue
            seen.add(identity)
            for line_number, text in _selected_lines(path, target.sections):
                findings.extend(
                    _findings_for_line(
                        config=config,
                        relative_path=relative,
                        profile=target.profile,
                        line_number=line_number,
                        text=text,
                        avoid=avoid,
                        canonical=canonical,
                    )
                )
    return sorted(findings, key=lambda finding: (finding.file, finding.line, finding.rule_id))


def format_findings(findings: list[Finding]) -> str:
    if not findings:
        return "authoring-check: no findings"
    lines = [f"authoring-check: {len(findings)} finding(s)"]
    for finding in findings:
        replacement = f" -> {finding.suggested_replacement!r}" if finding.suggested_replacement else ""
        lines.append(
            f"{finding.file}:{finding.line}: [{finding.severity}] {finding.rule_id} {finding.message}{replacement}"
        )
    return "\n".join(lines)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Check selected technical prose against a repository profile.")
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--config", type=Path, default=None)
    parser.add_argument("--json", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    repo_root = args.repo_root.resolve()
    try:
        config = load_config(repo_root, args.config)
        findings = check_repository(repo_root, config)
    except ValueError as exc:
        print(f"authoring-check: {exc}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps([asdict(finding) for finding in findings], ensure_ascii=False, indent=2))
    else:
        print(format_findings(findings))
    return 1 if any(finding.severity == "error" for finding in findings) else 0


if __name__ == "__main__":
    raise SystemExit(main())
