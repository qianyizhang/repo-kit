"""Optional drill-binding.yaml loader (zero-config when the file is absent)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from .models import Binding, Card, Locale

DEFAULT_BINDING_NAMES = ("drill-binding.yaml", "drill-binding.yml")


def load_binding(repo_root: Path, *, binding_path: Path | None = None) -> Binding:
    """Load optional binding; missing file → defaults (docs/glossary, bilingual)."""
    path = binding_path
    if path is None:
        for name in DEFAULT_BINDING_NAMES:
            candidate = repo_root / "docs" / "glossary" / name
            if candidate.is_file():
                path = candidate
                break
    if path is None or not path.is_file():
        return Binding()
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return binding_from_dict(data if isinstance(data, dict) else {})


def binding_from_dict(data: dict[str, Any] | None) -> Binding:
    if not data:
        return Binding()
    spine = tuple(str(x) for x in (data.get("spine") or []) if str(x).strip())

    paths_block = data.get("paths") or {}
    glossary = paths_block.get("glossary") if isinstance(paths_block, dict) else None
    if isinstance(glossary, list) and glossary:
        glossary_paths = tuple(str(p) for p in glossary)
    elif glossary:
        glossary_paths = (str(glossary),)
    else:
        glossary_paths = ("docs/glossary",)

    excludes = tuple(str(x) for x in (data.get("excludes") or []) if str(x).strip())
    locale_raw = str(data.get("locale") or "bilingual").strip().lower()
    locale: Locale = locale_raw if locale_raw in {"en", "zh", "bilingual"} else "bilingual"  # type: ignore[assignment]
    state_dir = str(data.get("state_dir") or "artifacts/glossary-drill")
    return Binding(
        spine=spine,
        glossary_paths=glossary_paths,
        excludes=excludes,
        locale=locale,
        state_dir=state_dir,
    )


def resolve_glossary_paths(repo_root: Path, binding: Binding) -> list[Path]:
    paths: list[Path] = []
    for rel in binding.glossary_paths:
        p = Path(rel)
        paths.append(p if p.is_absolute() else (repo_root / p))
    return paths


def filter_excluded(cards: list[Card], binding: Binding) -> list[Card]:
    if not binding.excludes:
        return list(cards)
    excl = {e.lower() for e in binding.excludes}
    return [c for c in cards if c.term.lower() not in excl]
