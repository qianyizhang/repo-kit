"""Local drill state under artifacts/glossary-drill/; keep it ignored locally.

One JSON file per learner profile. This is the single authoritative store:
scheduling (spaced repetition), lapses, and confusion history all live here.
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path

from .models import HARD_DECOY_CAP, MAX_BOX, Card, DrillState, TermState


def default_state_dir(repo_root: Path) -> Path:
    return repo_root / "artifacts" / "glossary-drill"


def default_profile() -> str:
    """Multi-learner by default: fall back to the OS user, then ``default``."""
    who = os.environ.get("GLOSSARY_DRILL_PROFILE") or os.environ.get("USER") or "default"
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", who.strip()).strip("-").lower()
    return slug or "default"


def state_path(state_dir: Path, profile: str) -> Path:
    return state_dir / f"state-{profile or 'default'}.json"


def load_state(state_dir: Path, *, profile: str = "default", repo_id: str = "") -> DrillState:
    path = state_path(state_dir, profile)
    if not path.is_file():
        return DrillState(profile=profile, repo_id=repo_id)
    state = DrillState.from_dict(json.loads(path.read_text(encoding="utf-8")))
    state.profile = profile
    if repo_id and not state.repo_id:
        state.repo_id = repo_id
    return state


def save_state(state_dir: Path, state: DrillState) -> Path:
    state_dir.mkdir(parents=True, exist_ok=True)
    path = state_path(state_dir, state.profile)
    path.write_text(
        json.dumps(state.to_dict(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return path


def repo_id_from_root(repo_root: Path) -> str:
    return str(repo_root.resolve())


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def bump_session(state: DrillState) -> int:
    """Advance the session clock; returns the new ordinal (drives SR intervals)."""
    state.sessions += 1
    return state.sessions


def record_answer(
    state: DrillState,
    term: str,
    *,
    correct: bool,
    confused_with: str | None = None,
    now: str | None = None,
) -> TermState:
    """Update one term's Leitner box, lapse counters, and confusion history.

    ``confused_with`` should be a real Term id (the wrong option the learner
    picked); it is remembered as a hard distractor for future rounds.
    """
    ts = state.term_state(term)
    ts.seen += 1
    ts.last_seen_session = state.sessions
    ts.last_seen_at = now or _now_iso()
    if correct:
        ts.passes += 1
        ts.box = min(ts.box + 1, MAX_BOX)
    else:
        ts.fails += 1
        ts.box = max(ts.box - 1, 0)  # lapse drops one box
        if confused_with and confused_with != term:
            if confused_with in ts.hard_decoys:
                ts.hard_decoys.remove(confused_with)
            ts.hard_decoys.append(confused_with)  # most-recent-last, capped below
            del ts.hard_decoys[:-HARD_DECOY_CAP]
    return ts


def bump_weak(state: DrillState, term: str, now: str | None = None) -> TermState:
    """Nudge a term toward the front of the queue without a full lapse.

    Used when lint catches a misuse: the term deserves review but the learner
    did not answer a question, so we lower its box and mark it unseen-recent.
    """
    ts = state.term_state(term)
    ts.box = max(ts.box - 1, 0)
    ts.last_seen_at = now or _now_iso()
    return ts


def coverage(state: DrillState, deck: Sequence[Card]) -> dict:
    """Learner-facing progress snapshot over the current deck."""
    total = len(deck)
    seen = mastered = 0
    weak: list[str] = []
    unseen: list[str] = []
    boxes = [0] * (MAX_BOX + 1)
    for card in deck:
        ts = state.terms.get(card.term)
        if ts is None or ts.seen == 0:
            unseen.append(card.term)
            continue
        seen += 1
        boxes[min(ts.box, MAX_BOX)] += 1
        if ts.mastered:
            mastered += 1
        elif ts.box <= 1 or ts.fails > ts.passes:
            weak.append(card.term)
    return {
        "profile": state.profile,
        "sessions": state.sessions,
        "total": total,
        "seen": seen,
        "unseen": unseen,
        "mastered": mastered,
        "weak": weak,
        "boxes": boxes,
    }
