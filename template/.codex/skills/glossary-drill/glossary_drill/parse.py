"""Parse glossary markdown tables into Card records (geometry only, no network).

Definitions and term *names* live in different columns, so we map them
structurally rather than guessing: ``中文`` / ``Chinese`` is the term name
(``term_zh``); ``中文解释`` / ``中文释义`` / ``Meaning`` / ``Definition`` is the
gloss. That split is what keeps a Chinese calque out of quiz stems.
"""

from __future__ import annotations

import re
from pathlib import Path

from .models import Card

_CONFUSABLE_SECTION_RE = re.compile(
    r"confusable|clarification|bounded\s+vocabulary|do\s+not\s+confuse|false\s+friend",
    re.IGNORECASE,
)
_HEADING_RE = re.compile(r"^#{1,6}\s+(.+?)\s*$")
_TABLE_SEP_RE = re.compile(r"^\|?\s*:?-{3,}")


def parse_glossary_paths(paths: list[Path] | tuple[Path, ...]) -> list[Card]:
    """Parse every ``*.md`` under the given glossary roots (files or dirs)."""
    cards: list[Card] = []
    seen: set[Path] = set()
    for root in paths:
        root = root.resolve()
        if not root.exists():
            continue
        files = [root] if root.is_file() else sorted(root.rglob("*.md"))
        for path in files:
            path = path.resolve()
            if path in seen:
                continue
            seen.add(path)
            cards.extend(parse_glossary_file(path))
    return cards


def parse_glossary_file(path: Path) -> list[Card]:
    return parse_glossary_markdown(path.read_text(encoding="utf-8"), source_path=str(path))


def parse_glossary_markdown(text: str, *, source_path: str = "") -> list[Card]:
    lines = text.splitlines()
    section = ""
    cards: list[Card] = []
    i = 0
    while i < len(lines):
        heading = _HEADING_RE.match(lines[i])
        if heading:
            section = heading.group(1).strip()
            i += 1
            continue
        if not lines[i].lstrip().startswith("|"):
            i += 1
            continue
        table: list[str] = []
        while i < len(lines) and lines[i].lstrip().startswith("|"):
            table.append(lines[i])
            i += 1
        cards.extend(_parse_table(table, section=section, source_path=source_path))
    return cards


def _parse_table(rows: list[str], *, section: str, source_path: str) -> list[Card]:
    if len(rows) < 2:
        return []
    col = _column_map(_split_row(rows[0]))
    if "term" not in col:
        return []

    body_start = 2 if _is_separator(rows[1]) else 1
    confusable = bool(_CONFUSABLE_SECTION_RE.search(section)) or "do_not_confuse" in col

    cards: list[Card] = []
    for line in rows[body_start:]:
        cells = _split_row(line)
        term = _strip_ticks(_cell(cells, col.get("term")))
        if not term or term.lower() in {"term", "---"}:
            continue

        full_form = _cell(cells, col.get("full_form")).strip()
        term_zh = _cell(cells, col.get("zh")).strip()  # 中文 = term name, never a gloss
        gloss_en = _cell(cells, col.get("gloss_en")).strip()
        gloss_zh = _cell(cells, col.get("gloss_zh")).strip()

        do_not = _cell(cells, col.get("do_not_confuse")).strip()
        avoid = _split_list(_cell(cells, col.get("avoid")))
        for part in _split_list(do_not):
            if part.lower() != term.lower() and part not in avoid:
                avoid.append(part)

        # Primary gloss: prefer an EN definition, then a Chinese one, then full form.
        gloss = gloss_en or gloss_zh or (full_form if full_form.lower() != term.lower() else term)
        # Second bilingual line only when it is a *distinct* real definition.
        quiz_zh = gloss_zh if (gloss_en and gloss_zh and gloss_zh != gloss_en) else ""

        cards.append(
            Card(
                term=term,
                gloss=gloss,
                full_form=full_form,
                term_zh=term_zh,
                gloss_zh=quiz_zh,
                avoid=tuple(avoid),
                confusable=confusable,
                do_not_confuse=do_not,
                section=section,
                source_path=source_path,
            )
        )
    return cards


def _column_map(headers: list[str]) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for idx, raw in enumerate(headers):
        h = re.sub(r"\s+", " ", raw.strip().lower().replace("`", ""))
        if h in {"term", "terms"}:
            mapping["term"] = idx
        elif "full form" in h or h == "full_form":
            mapping["full_form"] = idx
        elif "中文解释" in h or "中文释义" in h or h in {"释义", "gloss_zh"}:
            mapping["gloss_zh"] = idx
        elif h in {"中文", "zh", "chinese"}:
            mapping["zh"] = idx  # term name, kept out of glosses
        elif h in {"definition", "gloss", "explanation", "en", "english", "gloss_en"} or h.startswith("meaning"):
            mapping["gloss_en"] = idx
        elif "avoid" in h:
            mapping["avoid"] = idx
        elif "do not confuse" in h or "not confuse" in h or "≠" in h:
            mapping["do_not_confuse"] = idx
    return mapping


def _is_separator(line: str) -> bool:
    spaced = line.replace("|", " ")
    if _TABLE_SEP_RE.search(spaced):
        return True
    return set(line.replace("|", "").replace(":", "").replace("-", "").strip()) <= {"", " "}


def _split_row(line: str) -> list[str]:
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [c.strip() for c in line.split("|")]


def _cell(cells: list[str], idx: int | None) -> str:
    if idx is None or not (0 <= idx < len(cells)):
        return ""
    return cells[idx]


def _strip_ticks(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value.startswith("`") and value.endswith("`"):
        return value[1:-1].strip()
    return value


def _split_list(raw: str) -> list[str]:
    if not raw or raw.strip() in {"—", "-", "–", "N/A", "n/a"}:
        return []
    out: list[str] = []
    for part in re.split(r"[,;/]| or ", raw):
        token = _strip_ticks(part.strip())
        if token:
            out.append(token)
    return out
