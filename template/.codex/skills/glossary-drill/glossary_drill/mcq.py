"""Deterministic MCQ assembly — geometry only, no LLM, no network.

Two kinds carry the onboarding value: recognise the term from its definition
(``gloss_to_term``) and recall the definition from the term (``term_to_gloss``).
Confusable / _Avoid_ neighbours are not a separate question type — they are the
*sharpest distractors*, folded into both kinds. Distractors are always real
sibling terms; when the pool is too small we shrink the option count rather than
invent fake answers.
"""

from __future__ import annotations

import random
from collections.abc import Sequence

from .models import Card, DrillState, Locale, McqItem, McqKind

MIN_OPTIONS = 2


def build_mcq(
    card: Card,
    pool: Sequence[Card],
    *,
    state: DrillState | None = None,
    locale: Locale = "bilingual",
    kind: McqKind | None = None,
    n_options: int = 4,
    rng: random.Random | None = None,
    seed: int | None = None,
) -> McqItem:
    """Build one MCQ item for ``card`` from real sibling terms."""
    if rng is None:
        rng = random.Random(seed)  # seed=None → fresh entropy (varies each round)
    chosen_kind: McqKind = kind or rng.choice(["gloss_to_term", "term_to_gloss"])
    by_term = {c.term: c for c in pool}
    decoys = _decoy_cards(card, pool, by_term, state=state, rng=rng, n=n_options - 1)

    picks = [card, *decoys]
    rng.shuffle(picks)
    correct_index = picks.index(card)
    note = _short_note(card)

    if chosen_kind == "term_to_gloss":
        stem = _stem_term_to_gloss(card, locale)
        options = tuple(_display_gloss(c, locale) for c in picks)
    else:
        stem = _stem_gloss_to_term(card, locale)
        options = tuple(c.term for c in picks)

    return McqItem(
        kind=chosen_kind,
        term=card.term,
        stem=stem,
        options=options,
        option_terms=tuple(c.term for c in picks),
        option_glosses=tuple(_display_gloss(c, locale) for c in picks),
        correct_index=correct_index,
        note=note,
        locale=locale,
    )


def format_mcq(item: McqItem, *, reveal: bool = True) -> str:
    """Human-readable rendering. ``reveal`` prints the answer key for agents/tests."""
    lines = [item.stem, ""]
    for i, opt in enumerate(item.options):
        lines.append(f"  {chr(ord('A') + i)}. {opt}")
    if reveal:
        lines.append("")
        lines.append(f"(correct_term={item.correct_term})")
    return "\n".join(lines)


def explain(item: McqItem, chosen_index: int, *, locale: Locale = "bilingual") -> str:
    """Turn a miss into a teaching moment: what you picked vs. the answer, and why."""
    correct = f"{item.correct_term} — {item.correct_gloss}"
    if chosen_index == item.correct_index:
        return f"✓ {correct}"
    lines = [f"✗ answer: {correct}"]
    if 0 <= chosen_index < len(item.option_terms):
        picked_t = item.option_terms[chosen_index]
        picked_g = item.option_glosses[chosen_index]
        if picked_t != item.correct_term:
            lines.append(f"  you picked: {picked_t} — {picked_g}")
    if item.note:
        lines.append(f"  ≠ {item.note}")
    return "\n".join(lines)


def decoy_pool(
    card: Card,
    pool: Sequence[Card],
    *,
    state: DrillState | None = None,
    limit: int = 8,
) -> list[str]:
    """Ordered real-term decoy candidates for ``card`` — best distractors first.

    Shared by ``build_mcq`` (server-rendered CLI quiz) and the offline HTML
    ladder game's client-side MCQ builder, so both draw from exactly one
    "distractors are always real sibling terms, never fabricated" selection
    algorithm. The order is baked at build time; a per-round RNG in the
    consumer picks and shuffles from this pool.
    """
    by_term = {c.term: c for c in pool}
    ordered = _decoy_cards(card, pool, by_term, state=state, rng=random.Random(0), n=limit)
    return [c.term for c in ordered]


def _decoy_cards(
    card: Card,
    pool: Sequence[Card],
    by_term: dict[str, Card],
    *,
    state: DrillState | None,
    rng: random.Random,
    n: int,
) -> list[Card]:
    """Real sibling cards, best distractors first. Never fabricates fillers."""
    ordered: list[Card] = []
    seen = {card.term}

    def push(term: str) -> None:
        other = by_term.get(term)
        if other is not None and other.term not in seen:
            seen.add(other.term)
            ordered.append(other)

    # 1) terms the learner has actually confused this with (from state)
    if state is not None:
        ts = state.terms.get(card.term)  # non-mutating lookup
        if ts is not None:
            for term in ts.hard_decoys:
                push(term)
    # 2) declared confusable / _Avoid_ neighbours that are themselves real terms
    for term in (*card.avoid, *_split_neighbors(card.do_not_confuse)):
        push(term)
    # 3) same-section siblings, then 4) any remaining term
    same_section = [c for c in pool if c.section == card.section and c.term not in seen]
    rest = [c for c in pool if c.term not in seen]
    for group in (same_section, rest):
        rng.shuffle(group)
        for other in group:
            push(other.term)

    return ordered[: max(0, min(n, len(ordered)))]


def _split_neighbors(text: str) -> list[str]:
    import re

    return [p.strip() for p in re.split(r"[,;/]| or ", text) if p.strip()]


def note_for(card: Card) -> str:
    """The ``≠`` / do-not-confuse caveat shown on a miss. Public: shared with html_export."""
    return _short_note(card)


def _short_note(card: Card) -> str:
    if card.do_not_confuse:
        return card.do_not_confuse
    if card.avoid:
        return "avoid: " + ", ".join(card.avoid[:3])
    return ""


def _display_gloss(card: Card | None, locale: Locale) -> str:
    """Quiz-facing *definitions* only — never Chinese term names (``term_zh``)."""
    if card is None:
        return ""
    zh = (card.gloss_zh or "").strip()
    en = (card.gloss or "").strip()
    term_zh = (card.term_zh or "").strip()
    if zh and term_zh and zh == term_zh:
        zh = ""  # drop accidental term-name leakage
    if locale == "zh":
        return zh or en
    if locale == "en":
        return en or zh
    if zh and en and zh != en:
        return f"{zh}\n{en}"
    return zh or en


def _stem_gloss_to_term(card: Card, locale: Locale) -> str:
    gloss = _display_gloss(card, locale)
    return {
        "en": f"Which term matches?\n{gloss}",
        "zh": f"哪一术语匹配？\n{gloss}",
        "bilingual": f"Which term? / 哪一术语？\n{gloss}",
    }[locale]


def _stem_term_to_gloss(card: Card, locale: Locale) -> str:
    return {
        "en": f"What does `{card.term}` mean?",
        "zh": f"`{card.term}` 含义？",
        "bilingual": f"`{card.term}` — meaning? / 含义？",
    }[locale]
