"""Hermetic tests for glossary-drill (fixture glossary, no network)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from glossary_drill import __version__
from glossary_drill.binding import binding_from_dict, load_binding
from glossary_drill.cli import main
from glossary_drill.deck import default_deck, due_order, onboard_order
from glossary_drill.lint import lint_text
from glossary_drill.mcq import build_mcq, explain
from glossary_drill.models import HARD_DECOY_CAP, DrillState
from glossary_drill.parse import parse_glossary_file, parse_glossary_markdown
from glossary_drill.state import coverage, load_state, record_answer, save_state

SKILL_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_GLOSSARY = SKILL_ROOT / "fixtures" / "glossary"
FIXTURE_SAMPLE = FIXTURE_GLOSSARY / "sample.md"


def _cards():
    return parse_glossary_file(FIXTURE_SAMPLE)


# ---------------------------------------------------------------- parse / model


def test_version_semver_shape() -> None:
    parts = __version__.split(".")
    assert len(parts) == 3
    assert all(p.isdigit() for p in parts)


def test_parse_fixture_terms_avoid_confusable() -> None:
    by_term = {c.term: c for c in _cards()}
    assert {"Candidate", "ProtocolAtom", "Bounded Context"} <= set(by_term)
    cand = by_term["Candidate"]
    assert cand.confusable is True
    assert cand.term_zh == "抽取候选"
    # Chinese *name* must never be the quiz gloss (gives the answer away).
    assert cand.gloss_zh != "抽取候选"
    assert "草稿" in cand.gloss_zh or "不可信" in cand.gloss_zh
    assert len(cand.gloss) < 100
    assert {"ProtocolAtom", "CareGap"} <= set(cand.avoid)  # from ≠ column
    assert "context" in {a.lower() for a in by_term["Bounded Context"].avoid}
    assert by_term["Shared Kernel"].confusable is False
    assert by_term["Shared Kernel"].avoid == ()


def test_parse_confusable_section_header() -> None:
    md = """
## False friends

| Term | Full form | 中文 | 中文解释 | _Avoid_ |
| :--- | :--- | :--- | :--- | :--- |
| Foo | Foo | 佛 | A foo thing. | Bar |
"""
    cards = parse_glossary_markdown(md)
    assert len(cards) == 1
    assert cards[0].confusable is True
    assert cards[0].avoid == ("Bar",)


# ---------------------------------------------------------------- binding


def test_zero_config_binding_defaults() -> None:
    b = load_binding(Path("/nonexistent/repo-root-xyz"))
    assert b.locale == "bilingual"
    assert b.glossary_paths == ("docs/glossary",)
    assert b.spine == ()


def test_binding_spine_and_locale() -> None:
    b = binding_from_dict(
        {"spine": ["Candidate", "ProtocolAtom"], "locale": "zh", "paths": {"glossary": "fixtures/glossary"}}
    )
    assert b.spine == ("Candidate", "ProtocolAtom")
    assert b.locale == "zh"
    assert b.glossary_paths == ("fixtures/glossary",)


# ---------------------------------------------------------------- deck


def test_default_deck_prioritizes_confusable_avoid_spine() -> None:
    deck = default_deck(_cards(), binding_from_dict({"spine": ["Interface Layer"]}))
    terms = {c.term for c in deck}
    assert "Candidate" in terms  # confusable
    assert "Bounded Context" in terms  # has _Avoid_
    assert "Interface Layer" in terms  # spine even without avoid
    assert "Shared Kernel" not in terms  # none of the above


def test_onboard_spine_first() -> None:
    deck = default_deck(_cards(), binding_from_dict({"spine": ["ProtocolAtom", "Candidate"]}))
    ordered = onboard_order(deck, binding_from_dict({"spine": ["ProtocolAtom", "Candidate"]}))
    assert ordered[0].term == "ProtocolAtom"
    assert ordered[1].term == "Candidate"


# ---------------------------------------------------------------- MCQ


def test_mcq_correct_term_options_and_glosses() -> None:
    deck = default_deck(_cards(), binding_from_dict({"spine": ["Candidate"]}))
    card = next(c for c in deck if c.term == "Candidate")
    item = build_mcq(card, deck, locale="en", kind="gloss_to_term", seed=1)
    assert item.correct_term == "Candidate"
    assert "Candidate" in item.options
    assert len(item.option_glosses) == len(item.options)
    assert item.grade_letter(item.letter_for_correct()) is True


def test_mcq_distractors_are_real_terms_no_fillers() -> None:
    deck = default_deck(_cards(), binding_from_dict({}))
    real_terms = {c.term for c in deck}
    card = next(c for c in deck if c.term == "Candidate")
    item = build_mcq(card, deck, locale="en", kind="gloss_to_term", seed=5)
    assert set(item.option_terms) <= real_terms  # no Other2 / Alias3 / synthetic fillers
    assert "(unknown" not in " ".join(item.options)


def test_mcq_tiny_pool_shrinks_options_not_faked() -> None:
    small = parse_glossary_markdown(
        """
## Confusable
| Term | 中文 | Meaning | ≠ (do not confuse) |
| :-- | :-- | :-- | :-- |
| Alpha | 甲 | first letter | Beta |
| Beta | 乙 | second letter | Alpha |
"""
    )
    card = next(c for c in small if c.term == "Alpha")
    item = build_mcq(card, small, locale="en", kind="gloss_to_term", seed=2, n_options=4)
    assert set(item.option_terms) == {"Alpha", "Beta"}  # only two real terms exist
    assert len(item.options) == 2


def test_mcq_explain_teaches_on_miss() -> None:
    deck = default_deck(_cards(), binding_from_dict({}))
    card = next(c for c in deck if c.term == "Candidate")
    item = build_mcq(card, deck, locale="en", kind="gloss_to_term", seed=3)
    wrong_idx = next(i for i in range(len(item.options)) if i != item.correct_index)
    msg = explain(item, wrong_idx)
    assert "answer:" in msg
    assert item.correct_term in msg
    assert item.option_terms[wrong_idx] in msg  # names what you picked


def test_mcq_never_leaks_term_zh_calque() -> None:
    cards = _cards()
    card = next(c for c in cards if c.term == "ProtocolAtom")
    deck = default_deck(cards, binding_from_dict({}))
    item = build_mcq(card, deck, locale="bilingual", kind="term_to_gloss", seed=2)
    blob = item.stem + "\n" + "\n".join(item.options)
    assert "协议原子" not in blob
    assert "不可变" in blob or "Approved" in blob


# ---------------------------------------------------------------- scheduling / state


def test_record_answer_box_and_hard_decoys() -> None:
    state = DrillState()
    ts = record_answer(state, "X", correct=True)
    assert ts.box == 1 and ts.passes == 1
    record_answer(state, "X", correct=True)
    assert state.term_state("X").box == 2
    record_answer(state, "X", correct=False, confused_with="Y")
    ts = state.term_state("X")
    assert ts.box == 1 and ts.fails == 1
    assert ts.hard_decoys == ["Y"]
    for k in range(HARD_DECOY_CAP + 3):
        record_answer(state, "X", correct=False, confused_with=f"D{k}")
    assert len(state.term_state("X").hard_decoys) == HARD_DECOY_CAP
    assert state.term_state("X").box == 0  # repeated lapses floor at 0


def test_due_order_unseen_first_then_shaky_over_mastered() -> None:
    deck = default_deck(_cards(), binding_from_dict({"spine": list({c.term for c in _cards()})}))
    state = DrillState(sessions=1)
    record_answer(state, "ProtocolAtom", correct=False, confused_with="Candidate")
    for _ in range(5):
        record_answer(state, "Candidate", correct=True)  # mastered
    ordered = [c.term for c in due_order(deck, state)]
    assert ordered.index("ProtocolAtom") < ordered.index("Candidate")  # shaky before mastered
    unseen = [t for t in ordered if t not in {"ProtocolAtom", "Candidate"}]
    assert ordered.index(unseen[0]) < ordered.index("ProtocolAtom")  # unseen surfaces first


def test_state_roundtrip_profile_and_box(tmp_path: Path) -> None:
    state = DrillState(profile="alice", repo_id="r1")
    record_answer(state, "Candidate", correct=False, confused_with="ProtocolAtom")
    path = save_state(tmp_path, state)
    assert path.name == "state-alice.json"
    loaded = load_state(tmp_path, profile="alice", repo_id="r1")
    ts = loaded.term_state("Candidate")
    assert ts.fails == 1 and ts.box == 0
    assert ts.hard_decoys == ["ProtocolAtom"]


def test_coverage_report() -> None:
    deck = default_deck(_cards(), binding_from_dict({"spine": ["Interface Layer"]}))
    state = DrillState()
    cov = coverage(state, deck)
    assert cov["seen"] == 0 and cov["mastered"] == 0
    assert set(cov["unseen"]) == {c.term for c in deck}
    for _ in range(5):
        record_answer(state, deck[0].term, correct=True)
    cov = coverage(state, deck)
    assert deck[0].term not in cov["unseen"]
    assert cov["mastered"] >= 1


# ---------------------------------------------------------------- lint


def test_lint_flags_avoid_token() -> None:
    findings = lint_text("We will use the module boundary pattern and treat candidates as protocols.", _cards())
    assert "avoid" in {f.kind for f in findings}
    assert "module boundary" in {f.token.lower() for f in findings}


def test_lint_clean_prose() -> None:
    findings = lint_text(
        "The Candidate stays pre-review; ProtocolAtom is post-approval. Bounded Context is the right name.",
        _cards(),
    )
    assert [f for f in findings if f.kind == "avoid"] == []


# ---------------------------------------------------------------- CLI


def _base(tmp_path: Path, *cmd: str) -> list[str]:
    return [
        "--repo-root",
        str(tmp_path),
        "--glossary-dir",
        str(FIXTURE_GLOSSARY),
        "--state-dir",
        str(tmp_path / "state"),
        "--profile",
        "tester",
        *cmd,
    ]


def test_cli_quiz_and_lint(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(_base(tmp_path, "--locale", "en", "quiz", "--count", "2", "--seed", "7")) == 0
    out = capsys.readouterr().out
    assert "QUIZ" in out and "correct_term=" in out and "A." in out

    assert main(_base(tmp_path, "lint", "--text", "Prefer module boundary over Bounded Context.")) == 2
    lint_out = capsys.readouterr().out.lower()
    assert "finding" in lint_out or "avoid" in lint_out


def test_cli_quiz_json_and_record(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(_base(tmp_path, "quiz", "--count", "1", "--seed", "3", "--json")) == 0
    item = json.loads(capsys.readouterr().out)[0]
    assert {"option_glosses", "correct_term", "note"} <= set(item)
    # Agent grades from correct_index, then records — no separate grade tool needed.
    assert main(_base(tmp_path, "record", "--term", item["term"], "--correct")) == 0
    state = load_state(tmp_path / "state", profile="tester")
    assert state.term_state(item["term"]).passes >= 1


def test_cli_status(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    main(_base(tmp_path, "record", "--term", "Candidate", "--wrong", "--confused-with", "ProtocolAtom"))
    capsys.readouterr()
    assert main(_base(tmp_path, "status")) == 0
    out = capsys.readouterr().out
    assert "coverage" in out and "Candidate" in out


def test_cli_lint_record_nudges_queue(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    main(_base(tmp_path, "record", "--term", "Bounded Context", "--correct"))
    main(_base(tmp_path, "record", "--term", "Bounded Context", "--correct"))
    capsys.readouterr()
    assert load_state(tmp_path / "state", profile="tester").term_state("Bounded Context").box == 2
    main(_base(tmp_path, "lint", "--text", "use the module boundary here", "--record"))
    assert load_state(tmp_path / "state", profile="tester").term_state("Bounded Context").box == 1


def test_cli_html(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    out = tmp_path / "vibe.html"
    assert main(_base(tmp_path, "html", "--out", str(out), "--count", "3", "--seed", "1")) == 0
    printed = capsys.readouterr().out.strip()
    assert Path(printed) == out
    text = out.read_text(encoding="utf-8")
    assert "Glossary Drill" in text and "application/json" in text


# ---------------------------------------------------------------- HTML export


def test_html_export_theme_and_no_calque(tmp_path: Path) -> None:
    from glossary_drill.html_export import build_quiz_items, render_html, write_html

    deck = default_deck(_cards(), binding_from_dict({"spine": ["Candidate", "Bounded Context"]}))
    items = build_quiz_items(deck, state=DrillState(), locale="bilingual", count=3, seed=9)
    html = render_html(items, title="Test Drill")
    assert "Test Drill" in html and "quiz-data" in html
    # Both themes styled, plus a resume/sync bridge back to the CLI store.
    assert "prefers-color-scheme: dark" in html
    assert 'data-theme="light"' in html
    assert "glossary-drill record" in html  # browser → CLI sync bridge
    assert "抽取候选" not in html  # term-name calque never rendered as quiz content
    out = write_html(tmp_path / "q.html", items)
    assert out.is_file() and out.stat().st_size > 500


def test_real_confusable_glosses_are_short() -> None:
    """Consumer-glossary policy: confusable Meaning cells stay drill-short & bilingual."""
    repo = Path(__file__).resolve().parents[4]
    ddd = repo / "docs" / "glossary" / "ddd.md"
    if not ddd.is_file():
        pytest.skip("consumer glossary not present")
    conf = [c for c in parse_glossary_file(ddd) if c.confusable]
    assert conf, "expected confusable rows in ddd.md"
    for c in conf:
        assert len(c.gloss) <= 120, f"{c.term} gloss too long ({len(c.gloss)})"
        assert c.gloss_zh, f"{c.term} missing 中文释义 for bilingual drill"
        assert c.term_zh, f"{c.term} missing 中文 name"
        assert c.gloss_zh != c.term_zh, f"{c.term}: term name leaked into definition"
