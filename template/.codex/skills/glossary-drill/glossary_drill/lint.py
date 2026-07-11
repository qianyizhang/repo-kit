"""Lint free prose against glossary Term / _Avoid_ / confusable maps."""

from __future__ import annotations

import re
from collections.abc import Sequence

from .models import Card, LintFinding

# Tokens that are too short / generic to flag as "unknown"
_STOP = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "for",
    "with",
    "on",
    "is",
    "as",
    "by",
    "from",
    "this",
    "that",
    "we",
    "it",
    "be",
    "are",
    "was",
    "use",
    "used",
    "using",
}


def lint_text(text: str, cards: Sequence[Card]) -> list[LintFinding]:
    """Report avoid-token hits and confusable-neighbor misuse; no rewrite demanded."""
    if not text.strip():
        return []

    avoid_index: dict[str, list[Card]] = {}
    term_index: dict[str, Card] = {}
    for card in cards:
        term_index[card.term.lower()] = card
        for a in card.avoid:
            key = a.lower()
            avoid_index.setdefault(key, []).append(card)

    findings: list[LintFinding] = []
    seen: set[tuple[str, str]] = set()

    # Longer avoid phrases first
    avoid_keys = sorted(avoid_index.keys(), key=len, reverse=True)
    lower_text = text.lower()
    canonical_terms = sorted((c.term.lower() for c in cards), key=len, reverse=True)
    for key in avoid_keys:
        if len(key) < 3:
            continue
        # Skip when the token is itself a canonical Term (neighbor atoms, not aliases)
        if key in term_index:
            continue
        spans = list(_phrase_spans(lower_text, key))
        # Ignore matches that sit inside a longer canonical Term already in the text
        # (e.g. avoid "context" inside "Bounded Context").
        spans = [s for s in spans if not _span_inside_any(lower_text, s[0], s[1], canonical_terms)]
        if not spans:
            continue
        for card in avoid_index[key]:
            sig = ("avoid", key, card.term)
            if sig in seen:
                continue
            seen.add(sig)
            findings.append(
                LintFinding(
                    kind="avoid",
                    token=key,
                    message=f"Found _Avoid_ token {key!r}; prefer canonical term `{card.term}`.",
                    suggest_term=card.term,
                    source_path=card.source_path,
                )
            )

    # Confusable: if text mentions a "do not confuse" neighbor as if it were the concept
    # when the canonical term is also a better fit — flag neighbor-only mentions lightly.
    for card in cards:
        if not card.confusable and not card.do_not_confuse:
            continue
        for neighbor in card.avoid:
            nkey = neighbor.lower()
            if len(nkey) < 3:
                continue
            if not _contains_phrase(lower_text, nkey):
                continue
            # If canonical term also present, less severe; still report neighbor use
            sig = ("confusable_neighbor", nkey, card.term)
            if sig in seen:
                continue
            # Skip if this neighbor is itself a canonical term used correctly
            if nkey in term_index and term_index[nkey].term != card.term:
                # neighbor is another card — already covered when that card's avoid fires
                continue
            seen.add(sig)
            findings.append(
                LintFinding(
                    kind="confusable_neighbor",
                    token=neighbor,
                    message=(
                        f"Possible confusable misuse of {neighbor!r}; "
                        f"if you meant the concept behind `{card.term}`, use that term. "
                        f"Do not confuse with: {card.do_not_confuse or neighbor}."
                    ),
                    suggest_term=card.term,
                    source_path=card.source_path,
                )
            )

    return findings


def format_findings(findings: list[LintFinding]) -> str:
    if not findings:
        return "lint: no glossary issues found."
    lines = [f"lint: {len(findings)} finding(s)"]
    for i, f in enumerate(findings, 1):
        suggest = f" → `{f.suggest_term}`" if f.suggest_term else ""
        lines.append(f"  {i}. [{f.kind}] {f.token!r}{suggest}")
        lines.append(f"     {f.message}")
    return "\n".join(lines)


def _contains_phrase(lower_text: str, phrase: str) -> bool:
    return bool(_phrase_spans(lower_text, phrase))


def _phrase_spans(lower_text: str, phrase: str) -> list[tuple[int, int]]:
    phrase = phrase.lower().strip()
    if not phrase:
        return []
    if " " in phrase or "-" in phrase or "/" in phrase:
        spans: list[tuple[int, int]] = []
        start = 0
        while True:
            idx = lower_text.find(phrase, start)
            if idx < 0:
                break
            spans.append((idx, idx + len(phrase)))
            start = idx + len(phrase)
        return spans
    return [
        (m.start(), m.end())
        for m in re.finditer(
            rf"(?<![A-Za-z0-9_]){re.escape(phrase)}(?![A-Za-z0-9_])",
            lower_text,
        )
    ]


def _span_inside_any(
    lower_text: str,
    start: int,
    end: int,
    phrases: list[str],
) -> bool:
    for phrase in phrases:
        for ps, pe in _phrase_spans(lower_text, phrase):
            if ps <= start and end <= pe and (pe - ps) > (end - start):
                return True
    return False
