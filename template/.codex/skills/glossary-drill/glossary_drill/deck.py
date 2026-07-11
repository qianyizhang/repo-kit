"""Deck selection and ordering (default pool, onboard path, spaced repetition)."""

from __future__ import annotations

from .models import Binding, Card, DrillState


def default_deck(cards: list[Card], binding: Binding) -> list[Card]:
    """Confusable + _Avoid_ rows + spine terms (deduped, first-seen order)."""
    spine = {s.lower() for s in binding.spine}
    by_term: dict[str, Card] = {}
    for card in cards:
        key = card.term.lower()
        if card.in_default_pool or key in spine:
            by_term.setdefault(key, card)
    return list(by_term.values())


def full_deck(cards: list[Card]) -> list[Card]:
    by_term: dict[str, Card] = {}
    for card in cards:
        by_term.setdefault(card.term.lower(), card)
    return list(by_term.values())


def onboard_order(deck: list[Card], binding: Binding) -> list[Card]:
    """Guided first pass over ``deck``: spine → confusable → _Avoid_ → the rest."""
    by_lower = {c.term.lower(): c for c in deck}
    ordered: list[Card] = []
    seen: set[str] = set()

    def add(card: Card) -> None:
        key = card.term.lower()
        if key not in seen:
            seen.add(key)
            ordered.append(card)

    for term in binding.spine:
        card = by_lower.get(term.lower())
        if card:
            add(card)
    for card in deck:
        if card.confusable:
            add(card)
    for card in deck:
        if card.avoid:
            add(card)
    for card in deck:
        add(card)
    return ordered


def due_order(cards: list[Card], state: DrillState) -> list[Card]:
    """Spaced-repetition order: unseen & overdue-weak first, mastered last.

    Ties break by term id for stable, reproducible rounds. Question *content*
    (kind, distractors, option order) varies per session via the MCQ RNG, so a
    stable card order does not make the drill itself repetitive.
    """
    session = state.sessions

    def urgency(card: Card) -> float:
        ts = state.terms.get(card.term)  # non-mutating: unseen terms stay absent
        return 1000.0 if ts is None else ts.urgency(session)

    return sorted(cards, key=lambda c: (-urgency(c), c.term.lower()))
