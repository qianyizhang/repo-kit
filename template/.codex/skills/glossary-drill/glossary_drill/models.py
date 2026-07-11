"""Card, MCQ, lint, and spaced-repetition state models for glossary-drill."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, fields
from typing import Literal

Locale = Literal["en", "zh", "bilingual"]
McqKind = Literal["gloss_to_term", "term_to_gloss"]

# Leitner-style review boxes. box 0 = new/lapsed, MAX_BOX = mastered.
# INTERVALS[box] = sessions to wait before a term in that box is due again.
MAX_BOX = 5
INTERVALS: tuple[int, ...] = (0, 1, 2, 4, 8, 16)
MASTERED_BOX = 4  # box >= this (with passes > fails) counts as mastered
HARD_DECOY_CAP = 6  # keep at most this many "terms you confused this with"


@dataclass(frozen=True, slots=True)
class Card:
    """One glossary row turned into a drillable record.

    ``term_zh`` is the Chinese *name* of the term (often a transparent calque of
    the English id) — never put it in MCQ stems/options or it gives the answer
    away. Quiz content uses ``gloss`` (EN definition) and ``gloss_zh`` (Chinese
    *definition*, 中文解释/释义 only).
    """

    term: str
    gloss: str
    full_form: str = ""
    term_zh: str = ""
    gloss_zh: str = ""
    avoid: tuple[str, ...] = ()
    confusable: bool = False
    do_not_confuse: str = ""
    section: str = ""
    source_path: str = ""

    @property
    def in_default_pool(self) -> bool:
        return self.confusable or bool(self.avoid)


@dataclass(frozen=True, slots=True)
class Binding:
    """Optional repo binding (docs/glossary/drill-binding.yaml)."""

    spine: tuple[str, ...] = ()
    glossary_paths: tuple[str, ...] = ("docs/glossary",)
    excludes: tuple[str, ...] = ()
    locale: Locale = "bilingual"
    state_dir: str = "artifacts/glossary-drill"


@dataclass(frozen=True, slots=True)
class McqItem:
    """One multiple-choice item. ``correct_term`` is always the English Term id.

    Options carry both their term id and gloss so a miss can be *explained*
    (show what you picked and why the answer differs), not just marked wrong.
    """

    kind: McqKind
    term: str
    stem: str
    options: tuple[str, ...]  # display strings, in A.. order
    option_terms: tuple[str, ...]  # English term id behind each option
    option_glosses: tuple[str, ...]  # definition behind each option
    correct_index: int
    note: str = ""  # ≠ / do-not-confuse caveat surfaced on a miss
    locale: Locale = "bilingual"

    @property
    def correct_term(self) -> str:
        return self.option_terms[self.correct_index]

    @property
    def correct_gloss(self) -> str:
        return self.option_glosses[self.correct_index]

    def letter_for_correct(self) -> str:
        return chr(ord("A") + self.correct_index)

    def index_for_letter(self, letter: str) -> int:
        cleaned = letter.strip().upper()
        if len(cleaned) != 1 or not cleaned.isalpha():
            return -1
        return ord(cleaned) - ord("A")

    def grade_letter(self, letter: str) -> bool:
        return self.index_for_letter(letter) == self.correct_index


@dataclass
class LintFinding:
    kind: Literal["avoid", "confusable_neighbor"]
    token: str
    message: str
    suggest_term: str = ""
    source_path: str = ""


@dataclass
class TermState:
    """Per-term spaced-repetition record (Leitner box + recency + lapses)."""

    box: int = 0
    fails: int = 0
    passes: int = 0
    seen: int = 0
    last_seen_session: int | None = None
    last_seen_at: str = ""
    # Real terms this term was confused with — the sharpest distractors. Capped.
    hard_decoys: list[str] = field(default_factory=list)

    @property
    def mastered(self) -> bool:
        return self.box >= MASTERED_BOX and self.passes > self.fails

    def urgency(self, session: int) -> float:
        """Higher → drill sooner. Unseen first, then due & shaky, mastered recede."""
        if self.last_seen_session is None:
            return 1000.0  # never drilled — highest priority
        interval = INTERVALS[min(self.box, len(INTERVALS) - 1)]
        overdue = (session - self.last_seen_session) - interval
        if overdue >= 0:
            # Due: shakier boxes and more lapses surface first.
            return 100.0 + self.fails * 5.0 - self.box * 8.0 + min(float(overdue), 20.0)
        return -self.box * 10.0 + overdue  # not due — recede (mastered sink lowest)


@dataclass
class DrillState:
    """One learner's progress for one repo. Keyed on disk by ``profile``."""

    profile: str = "default"
    repo_id: str = ""
    sessions: int = 0
    terms: dict[str, TermState] = field(default_factory=dict)

    def term_state(self, term: str) -> TermState:
        if term not in self.terms:
            self.terms[term] = TermState()
        return self.terms[term]

    def to_dict(self) -> dict:
        return {
            "profile": self.profile,
            "repo_id": self.repo_id,
            "sessions": self.sessions,
            "terms": {k: asdict(v) for k, v in self.terms.items()},
        }

    @classmethod
    def from_dict(cls, data: dict) -> DrillState:
        raw_terms = (data or {}).get("terms") or {}
        return cls(
            profile=str((data or {}).get("profile") or "default"),
            repo_id=str((data or {}).get("repo_id") or ""),
            sessions=int((data or {}).get("sessions") or 0),
            terms={k: _term_from_dict(v) for k, v in raw_terms.items()},
        )


_TERM_FIELDS = {f.name for f in fields(TermState)}


def _term_from_dict(data: dict) -> TermState:
    """Tolerant loader — ignores unknown/legacy keys, keeps forward compat."""
    kept = {k: v for k, v in (data or {}).items() if k in _TERM_FIELDS}
    ts = TermState(**kept)
    ts.hard_decoys = list(ts.hard_decoys or [])
    return ts
