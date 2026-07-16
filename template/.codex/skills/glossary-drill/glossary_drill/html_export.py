"""Self-contained offline HTML game — the Mastery Ladder (no network, single file).

Presentation only — glossary markdown stays SSOT. Each term climbs Leitner
boxes ``0..MAX_BOX``; box ``MASTERED_BOX``+ swaps multiple-choice for free
recall (type the term from memory). A miss drops the chip back to box 0. All
of this — challenge selection, MCQ decoys, grading, combo/XP, the ladder
board — runs client-side in vanilla JS so the file stays a zero-dependency,
zero-network artifact; Python's job is only to bake each card's initial box
(continuity with CLI ``--record`` state) and its real-term decoy pool so the
browser never has to invent a distractor.

The browser owns live progress in its own localStorage store (mirrors the
CLI's Leitner state but does not share it) and offers a **Sync to CLI** block
on the done screen so a browser session folds back into
``artifacts/glossary-drill`` via ordinary ``glossary-drill record`` calls.
"""

from __future__ import annotations

import html
import json
from collections.abc import Sequence
from pathlib import Path

from . import __version__
from .mcq import decoy_pool, note_for
from .models import MASTERED_BOX, MAX_BOX, Card, DrillState, Locale


def _gloss_pair(card: Card, locale: Locale) -> tuple[str, str]:
    """(en_line, zh_line) — quiz-facing *definitions* only, never term names."""
    en = (card.gloss or "").strip()
    zh = (card.gloss_zh or "").strip()
    term_zh = (card.term_zh or "").strip()
    if zh and term_zh and zh == term_zh:
        zh = ""  # drop accidental term-name leakage
    if locale == "en":
        return en, ""
    if locale == "zh":
        return "", (zh or en)
    return en, (zh if zh and zh != en else "")


def card_to_payload(
    card: Card,
    pool: Sequence[Card],
    *,
    state: DrillState | None,
    locale: Locale,
    limit: int = 8,
) -> dict:
    en, zh = _gloss_pair(card, locale)
    ts = state.terms.get(card.term) if state is not None else None
    return {
        "term": card.term,
        "en": en,
        "zh": zh,
        "note": note_for(card),
        "box": ts.box if ts is not None else 0,
        "neighbors": decoy_pool(card, pool, state=state, limit=limit),
    }


def build_ladder_payload(
    deck: Sequence[Card],
    *,
    state: DrillState | None = None,
    locale: Locale = "bilingual",
    limit: int = 8,
) -> list[dict]:
    """One payload row per card — the whole session board, not a fixed item batch.

    Unlike the old fixed-question-list export, the client picks challenge kind
    (MCQ vs. recall) and MCQ decoys *live* from this per-card data as boxes
    change during play, so a climb or a drop is reflected immediately.
    """
    pool = list(deck)
    return [card_to_payload(card, pool, state=state, locale=locale, limit=limit) for card in pool]


def render_html(
    payload: Sequence[dict],
    *,
    title: str = "Glossary Mastery Ladder",
    subtitle: str = "通用语言 · ubiquitous language",
) -> str:
    data_json = json.dumps(list(payload), ensure_ascii=False).replace("</", "<\\/")
    return _TEMPLATE.format(
        title=html.escape(title),
        subtitle=html.escape(subtitle),
        version=html.escape(__version__),
        count=len(payload),
        data_json=data_json,
        max_box=MAX_BOX,
        mastered_box=MASTERED_BOX,
        recall_floor=MASTERED_BOX - 1,
    )


def write_html(
    path: Path,
    payload: Sequence[dict],
    *,
    title: str = "Glossary Mastery Ladder",
    subtitle: str = "通用语言 · ubiquitous language",
) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_html(payload, title=title, subtitle=subtitle), encoding="utf-8")
    return path


_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{title}</title>
<style>
  :root {{
    color-scheme: light dark;
    --bg: #f5f7fa; --surface: #ffffff; --surface-2: #eef1f6; --line: #dbe1ea;
    --ink: #1a2028; --muted: #5c6675; --accent: #c2761e; --accent-soft: rgba(194,118,30,0.10);
    --good: #1f9d63; --good-soft: rgba(31,157,99,0.12); --bad: #cf4658; --bad-soft: rgba(207,70,88,0.12);
    --btn-ink: #ffffff; --radius: 14px;
    --font: "Inter", "SF Pro Text", "PingFang SC", "Noto Sans SC", system-ui, sans-serif;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }}
  @media (prefers-color-scheme: dark) {{
    :root {{
      --bg: #0b0e14; --surface: #12161f; --surface-2: #1a212c; --line: #232a35;
      --ink: #e6ebf2; --muted: #8a94a6; --accent: #f2a63b; --accent-soft: rgba(242,166,59,0.14);
      --good: #46c98b; --good-soft: rgba(70,201,139,0.12); --bad: #e5657a; --bad-soft: rgba(229,101,122,0.12);
      --btn-ink: #0b0e14;
    }}
  }}
  :root[data-theme="light"] {{
    --bg: #f5f7fa; --surface: #ffffff; --surface-2: #eef1f6; --line: #dbe1ea;
    --ink: #1a2028; --muted: #5c6675; --accent: #c2761e; --accent-soft: rgba(194,118,30,0.10);
    --good: #1f9d63; --good-soft: rgba(31,157,99,0.12); --bad: #cf4658; --bad-soft: rgba(207,70,88,0.12);
    --btn-ink: #ffffff;
  }}
  :root[data-theme="dark"] {{
    --bg: #0b0e14; --surface: #12161f; --surface-2: #1a212c; --line: #232a35;
    --ink: #e6ebf2; --muted: #8a94a6; --accent: #f2a63b; --accent-soft: rgba(242,166,59,0.14);
    --good: #46c98b; --good-soft: rgba(70,201,139,0.12); --bad: #e5657a; --bad-soft: rgba(229,101,122,0.12);
    --btn-ink: #0b0e14;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; min-height: 100%; font-family: var(--font); color: var(--ink);
    background: var(--bg); -webkit-font-smoothing: antialiased; }}
  body {{ display: flex; justify-content: center; padding: 28px 16px 60px; }}
  ::selection {{ background: var(--accent-soft); }}
  @keyframes pop {{ 0% {{ transform: scale(.7); opacity: 0; }} 60% {{ transform: scale(1.06); }} 100% {{ transform: scale(1); opacity: 1; }} }}
  @keyframes climbflash {{ 0% {{ box-shadow: 0 0 0 0 var(--good-soft); }} 100% {{ box-shadow: 0 0 0 8px rgba(0,0,0,0); }} }}
  @keyframes dropshake {{ 0%,100% {{ transform: translateX(0); }} 20% {{ transform: translateX(-4px); }} 40% {{ transform: translateX(4px); }} 60% {{ transform: translateX(-3px); }} 80% {{ transform: translateX(3px); }} }}
  @keyframes fadeup {{ from {{ opacity: 0; transform: translateY(8px); }} to {{ opacity: 1; transform: translateY(0); }} }}
  .shell {{ width: min(880px, 100%); }}
  header {{ display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }}
  header h1 {{ margin: 0; font-size: 1.3rem; font-weight: 700; letter-spacing: -0.02em; }}
  header p {{ margin: 6px 0 0; color: var(--muted); font-size: 0.85rem; }}
  .head-stats {{ display: flex; gap: 12px; align-items: center; }}
  .head-stat {{ text-align: right; }}
  .head-stat .n {{ font: 700 18px var(--mono); color: var(--accent); }}
  .head-stat .n.good {{ color: var(--good); }}
  .head-stat .l {{ font: 600 10px var(--mono); color: var(--muted); letter-spacing: .08em; }}
  .head-div {{ width: 1px; height: 30px; background: var(--line); }}
  .theme-btn {{ flex: none; appearance: none; cursor: pointer; border: 1px solid var(--line);
    background: var(--surface); color: var(--muted); border-radius: 8px; width: 34px; height: 34px; font-size: 1rem; }}
  .theme-btn:hover {{ border-color: var(--accent); color: var(--accent); }}
  .hidden {{ display: none !important; }}
  section.panel {{ border: 1px solid var(--line); background: var(--surface); border-radius: var(--radius); padding: 28px; animation: fadeup .25s ease; }}
  .splash h2 {{ margin: 0 0 12px; font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; }}
  .splash p {{ margin: 0 0 20px; color: var(--muted); font-size: 0.92rem; line-height: 1.6; max-width: 560px; }}
  .stat-row {{ display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 22px; }}
  .stat-row .n {{ font: 700 22px var(--mono); }}
  .stat-row .n.good {{ color: var(--good); }}
  .stat-row .n.bad {{ color: var(--bad); }}
  .stat-row .l {{ color: var(--muted); font-size: 0.78rem; margin-top: 2px; }}
  .btn {{ appearance: none; border: 0; cursor: pointer; border-radius: 11px; padding: 12px 20px;
    font: inherit; font-size: 0.9rem; font-weight: 700; background: var(--accent); color: var(--btn-ink);
    transition: opacity .12s; }}
  .btn:hover {{ opacity: 0.92; }}
  .btn:disabled {{ opacity: 0.35; cursor: not-allowed; }}
  .btn.ghost {{ background: transparent; color: var(--muted); border: 1px solid var(--line); font-weight: 500; }}
  .row {{ display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }}
  .saved-hint {{ color: var(--muted); font-size: 0.75rem; font-family: var(--mono); }}
  .play-grid {{ display: flex; gap: 18px; align-items: stretch; flex-wrap: wrap; }}
  .board {{ flex: 1 1 320px; border: 1px solid var(--line); background: var(--surface); border-radius: var(--radius); padding: 16px 16px 18px; }}
  .board-head {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }}
  .board-head .t {{ font: 600 11px var(--mono); color: var(--muted); letter-spacing: .08em; }}
  .board-head .c {{ font: 600 12px var(--mono); color: var(--good); }}
  .rungs {{ display: flex; flex-direction: column; gap: 7px; }}
  .rung {{ display: flex; gap: 10px; align-items: center; border-radius: 11px; padding: 7px 9px; background: var(--surface-2); border: 1px solid var(--line); }}
  .rung.mastered {{ background: var(--good-soft); border-color: var(--good); }}
  .rung-num {{ flex: none; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center;
    font: 700 12px var(--mono); color: var(--muted); background: var(--bg); border: 1px solid var(--line); }}
  .rung.mastered .rung-num {{ color: var(--good); border-color: var(--good); }}
  .chips {{ flex: 1; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 28px; }}
  .chip {{ font: 600 12px var(--mono); padding: 5px 9px; border-radius: 7px; border: 1.5px solid var(--line);
    background: var(--surface); color: var(--ink); white-space: nowrap; transition: all .3s ease; }}
  .chip.current {{ border-color: var(--accent); background: var(--accent-soft); color: var(--accent); animation: pop .3s ease; }}
  .chip.mastered {{ border-color: var(--good); background: var(--good-soft); color: var(--good); }}
  .chip.climbed {{ border-color: var(--good); background: var(--good-soft); color: var(--good); animation: climbflash .55s ease; }}
  .chip.dropped {{ border-color: var(--bad); background: var(--bad-soft); color: var(--bad); animation: dropshake .4s ease; }}
  .challenge-col {{ flex: 1 1 360px; display: flex; flex-direction: column; gap: 12px; }}
  .hud {{ display: flex; gap: 10px; }}
  .hud-tile {{ flex: 1; border: 1px solid var(--line); background: var(--surface); border-radius: 12px; padding: 10px 12px; }}
  .hud-tile .n {{ font: 700 18px var(--mono); }}
  .hud-tile .l {{ font: 600 10px var(--mono); color: var(--muted); letter-spacing: .06em; }}
  .card {{ border: 1px solid var(--line); background: var(--surface); border-radius: var(--radius); padding: 22px; flex: 1; display: flex; flex-direction: column; }}
  .card-top {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }}
  .kind-tag {{ font: 600 11px var(--mono); letter-spacing: .07em; padding: 4px 9px; border-radius: 7px;
    color: var(--muted); background: var(--surface-2); border: 1px solid var(--line); }}
  .kind-tag.recall {{ color: var(--accent); background: var(--accent-soft); border-color: var(--accent); }}
  .box-indicator {{ font: 600 12px var(--mono); color: var(--muted); }}
  .gloss-en {{ font: 600 20px/1.45 var(--font); margin-bottom: 6px; }}
  .gloss-zh {{ color: var(--muted); font-size: 0.95rem; line-height: 1.5; margin-bottom: 18px; }}
  .options {{ display: flex; flex-direction: column; gap: 9px; }}
  button.opt {{ appearance: none; width: 100%; text-align: left; border: 1.5px solid var(--line);
    background: var(--surface-2); color: var(--ink); border-radius: 12px; padding: 12px 14px; cursor: pointer;
    display: flex; align-items: center; gap: 12px; font: inherit; font-size: 0.92rem; transition: border-color .12s, background .12s; }}
  button.opt:hover:not(:disabled) {{ border-color: var(--accent); }}
  button.opt:disabled {{ cursor: default; }}
  button.opt .letter {{ flex: none; width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center;
    font: 600 12px var(--mono); color: var(--muted); background: var(--bg); border: 1px solid var(--line); }}
  button.opt .term {{ flex: 1; font-family: var(--mono); font-size: 0.9rem; }}
  button.opt .mark {{ font-weight: 700; }}
  button.opt.correct {{ border-color: var(--good); background: var(--good-soft); }}
  button.opt.correct .letter {{ color: var(--good); border-color: var(--good); }}
  button.opt.correct .mark {{ color: var(--good); }}
  button.opt.wrong {{ border-color: var(--bad); background: var(--bad-soft); }}
  button.opt.wrong .letter {{ color: var(--bad); border-color: var(--bad); }}
  button.opt.wrong .mark {{ color: var(--bad); }}
  button.opt.dim {{ opacity: 0.4; }}
  .type-row {{ display: flex; gap: 10px; }}
  .type-row input {{ flex: 1; background: var(--bg); border: 1.5px solid var(--line); border-radius: 11px;
    padding: 12px 14px; color: var(--ink); font-size: 0.95rem; font-family: var(--mono); outline: none; }}
  .type-row input.correct {{ border-color: var(--good); }}
  .type-row input.wrong {{ border-color: var(--bad); }}
  .type-row button {{ flex: none; }}
  .type-hint {{ font: 500 11px var(--mono); color: var(--muted); margin-top: 8px; }}
  .feedback {{ border-radius: 12px; padding: 13px 14px; margin-top: 16px; font-size: 0.86rem; line-height: 1.5; }}
  .feedback.good {{ background: var(--good-soft); border: 1px solid var(--good); }}
  .feedback.bad {{ background: var(--bad-soft); border: 1px solid var(--bad); }}
  .feedback .head {{ font: 700 14px var(--mono); }}
  .feedback.good .head {{ color: var(--good); }}
  .feedback.bad .head {{ color: var(--bad); }}
  .feedback .sub {{ color: var(--muted); margin-top: 5px; }}
  .feedback code {{ font-family: var(--mono); color: var(--bad); }}
  .card-actions {{ display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: auto; padding-top: 18px; }}
  .score-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 22px 0 14px; }}
  .stat {{ background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; padding: 16px; text-align: center; }}
  .stat .n {{ font-size: 1.6rem; font-weight: 700; font-family: var(--mono); letter-spacing: -0.02em; }}
  .stat .l {{ color: var(--muted); font-size: 0.75rem; margin-top: 3px; }}
  .miss-list {{ margin: 0 0 22px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }}
  .miss-list li {{ border: 1px solid var(--line); border-radius: 10px; padding: 11px 13px; background: var(--surface-2); font-size: 0.85rem; color: var(--muted); }}
  .miss-list code {{ font-family: var(--mono); color: var(--accent); font-weight: 600; }}
  .miss-label {{ font: 600 11px var(--mono); color: var(--muted); letter-spacing: .07em; margin-bottom: 10px; }}
  details.sync {{ margin: 4px 0 20px; font-size: 0.82rem; color: var(--muted); }}
  details.sync summary {{ cursor: pointer; }}
  details.sync textarea {{ width: 100%; margin-top: 8px; min-height: 96px; resize: vertical;
    font-family: var(--mono); font-size: 0.76rem; background: var(--surface-2); color: var(--ink);
    border: 1px solid var(--line); border-radius: 8px; padding: 10px; }}
  @media (max-width: 560px) {{ section.panel {{ padding: 20px; }} .score-grid {{ grid-template-columns: 1fr; }} }}
</style>
</head>
<body>
<div class="shell">
  <header>
    <div>
      <h1>{title} <span class="saved-hint" style="border:1px solid var(--line);border-radius:6px;padding:3px 7px;">glossary-drill v{version}</span></h1>
      <p>{subtitle} · climb every term to box {max_box} · {count} terms</p>
    </div>
    <div class="row">
      <div class="head-stats">
        <div class="head-stat"><div class="n" id="xpTotal">0</div><div class="l">TOTAL XP</div></div>
        <div class="head-div"></div>
        <div class="head-stat"><div class="n good" id="bestComboLabel">—</div><div class="l">BEST COMBO</div></div>
      </div>
      <button class="theme-btn" id="themeBtn" type="button" title="Toggle theme" aria-label="Toggle theme">◐</button>
    </div>
  </header>

  <section class="panel" id="startScreen">
    <div class="splash">
      <h2>Recall gets harder the higher you climb.</h2>
      <p>Every prompt gives you a definition — you supply the term. Boxes 0–{recall_floor} are multiple choice with
        real confusable neighbours as decoys. At <b>box {mastered_box}+</b> the options disappear: you
        <b>type the term from memory</b>. A correct answer climbs a rung; a miss drops the chip straight back to
        box 0.</p>
      <div class="stat-row">
        <div><div class="n" id="dueCount">0</div><div class="l">terms in play</div></div>
        <div><div class="n good" id="masteredCount">0</div><div class="l">already at box {max_box}</div></div>
        <div><div class="n bad" id="weakCount">0</div><div class="l">sitting in box 0</div></div>
      </div>
      <div class="row">
        <button class="btn" id="startBtn" type="button">开始 · Start climb ↗</button>
        <button class="btn ghost" id="resetBtn" type="button">Reset ladder</button>
        <span class="saved-hint">progress saved locally · offline</span>
      </div>
    </div>
  </section>

  <section class="play-grid hidden" id="playScreen">
    <div class="board">
      <div class="board-head"><span class="t">THE LADDER</span><span class="c" id="clearedLabel">0 / 0 at box {max_box}</span></div>
      <div class="rungs" id="rungs"></div>
    </div>
    <div class="challenge-col">
      <div class="hud">
        <div class="hud-tile"><div class="n" id="comboLabel" style="color:var(--ink)">—</div><div class="l">COMBO</div></div>
        <div class="hud-tile"><div class="n" id="sessionXp" style="color:var(--accent)">0</div><div class="l">XP THIS RUN</div></div>
        <div class="hud-tile"><div class="n" id="accuracyLabel">—</div><div class="l">ACCURACY</div></div>
      </div>
      <div class="card">
        <div class="card-top">
          <span class="kind-tag" id="kindTag">RECOGNISE</span>
          <span class="box-indicator" id="boxIndicator">box 0 → 1</span>
        </div>
        <div class="gloss-en" id="glossEn"></div>
        <div class="gloss-zh" id="glossZh"></div>
        <div class="options" id="options"></div>
        <div class="hidden" id="typeBlock">
          <div class="type-row">
            <input id="typeInput" placeholder="type the term…" autocomplete="off" spellcheck="false"/>
            <button class="btn" id="submitTypeBtn" type="button">Check</button>
          </div>
          <div class="type-hint">free recall · box {mastered_box}+ · Enter to check</div>
        </div>
        <div class="feedback hidden" id="feedback"></div>
        <div class="card-actions">
          <button class="btn ghost" id="endBtn" type="button">End session</button>
          <button class="btn" id="nextBtn" type="button" disabled>Next →</button>
        </div>
      </div>
    </div>
  </section>

  <section class="panel hidden" id="doneScreen">
    <div class="miss-label" style="letter-spacing:.1em;">SESSION COMPLETE</div>
    <h2 id="doneTitle" style="margin:0 0 20px;font-size:1.6rem;">Keep drilling.</h2>
    <div class="score-grid">
      <div class="stat"><div class="n" id="doneCleared" style="color:var(--good)">0</div><div class="l">reached box {max_box}</div></div>
      <div class="stat"><div class="n" id="doneXp" style="color:var(--accent)">+0</div><div class="l">XP earned</div></div>
      <div class="stat"><div class="n" id="donePct">0%</div><div class="l">accuracy</div></div>
    </div>
    <div class="miss-label">STILL SHAKY</div>
    <ul class="miss-list" id="missList"></ul>
    <details class="sync" id="syncBox">
      <summary>Sync to CLI state · 同步进度</summary>
      <p>Paste into your terminal to fold this run into <code>artifacts/glossary-drill</code>:</p>
      <textarea id="syncText" readonly></textarea>
      <button class="btn ghost" id="copySyncBtn" type="button" style="margin-top:8px;">Copy</button>
    </details>
    <div class="row">
      <button class="btn" id="againBtn" type="button">Keep climbing ↗</button>
      <button class="btn ghost" id="resetBtn2" type="button">Reset ladder</button>
    </div>
  </section>
</div>

<script id="ladder-data" type="application/json">{data_json}</script>
<script>
(function () {{
  var MAX_BOX = {max_box}, MASTERED_BOX = {mastered_box};
  var STORE_KEY = 'glossary-drill:ladder:v1';
  var THEME_KEY = 'glossary-drill:theme';
  var CARDS = JSON.parse(document.getElementById('ladder-data').textContent);
  var byTerm = {{}};
  CARDS.forEach(function (c) {{ byTerm[c.term] = c; }});

  var $ = function (id) {{ return document.getElementById(id); }};
  var screens = ['startScreen', 'playScreen', 'doneScreen'].map($);
  function show(el) {{ screens.forEach(function (s) {{ s.classList.add('hidden'); }}); el.classList.remove('hidden'); }}

  function loadStore() {{
    try {{ return JSON.parse(localStorage.getItem(STORE_KEY)) || {{}}; }} catch (e) {{ return {{}}; }}
  }}
  function saveStore() {{
    try {{ localStorage.setItem(STORE_KEY, JSON.stringify({{boxes: boxes, xp: xp, bestCombo: bestCombo}})); }} catch (e) {{}}
  }}

  // ---- theme ----
  function applyTheme(t) {{
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }}
  var theme = null;
  try {{ theme = localStorage.getItem(THEME_KEY); }} catch (e) {{}}
  applyTheme(theme);
  $('themeBtn').addEventListener('click', function () {{
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    theme = isDark ? 'light' : 'dark';
    applyTheme(theme);
    try {{ localStorage.setItem(THEME_KEY, theme); }} catch (e) {{}}
  }});

  // ---- persistent progress (per-term box seeded from the CLI state Python baked in) ----
  var saved = loadStore();
  var boxes = {{}};
  CARDS.forEach(function (c) {{ boxes[c.term] = (saved.boxes && saved.boxes[c.term] != null) ? saved.boxes[c.term] : c.box; }});
  var xp = saved.xp || 0, bestCombo = saved.bestCombo || 0;

  // ---- session state ----
  var session = [], current = null, challenge = null, answered = false;
  var lastCorrect = false, lastPicked = null, typeValue = '';
  var combo = 0, sessionXp = 0, correct = 0, miss = 0;
  var misses = [], answers = [], changed = null, dir = null;

  function norm(s) {{ return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }}
  function shuffle(a) {{
    for (var i = a.length - 1; i > 0; i--) {{
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }}
    return a;
  }}

  function buildChallenge(term) {{
    var c = byTerm[term];
    var box = boxes[term];
    if (box >= MASTERED_BOX) return {{type: 'type', term: term}};
    var decoys = shuffle((c.neighbors || []).slice()).slice(0, 3);
    var options = shuffle([term].concat(decoys));
    return {{type: 'mcq', term: term, options: options}};
  }}

  function pickNext() {{
    var cands = session.filter(function (t) {{ return boxes[t] < MAX_BOX && t !== current; }});
    if (!cands.length) cands = session.filter(function (t) {{ return boxes[t] < MAX_BOX; }});
    if (!cands.length) return null;
    var minBox = Math.min.apply(null, cands.map(function (t) {{ return boxes[t]; }}));
    var pref = cands.filter(function (t) {{ return boxes[t] <= minBox + 1; }});
    return pref[Math.floor(Math.random() * pref.length)];
  }}

  function startSession() {{
    session = CARDS.filter(function (c) {{ return boxes[c.term] < MAX_BOX; }}).map(function (c) {{ return c.term; }});
    if (!session.length) {{
      CARDS.forEach(function (c) {{ boxes[c.term] = c.box; }});
      session = CARDS.filter(function (c) {{ boxes[c.term] < MAX_BOX; }}).map(function (c) {{ return c.term; }});
    }}
    current = null; combo = 0; sessionXp = 0; correct = 0; miss = 0; misses = []; answers = []; answered = false; changed = null;
    show($('playScreen'));
    current = pickNext();
    challenge = buildChallenge(current);
    typeValue = ''; answered = false;
    renderPlay();
  }}

  function resetLadder() {{
    CARDS.forEach(function (c) {{ boxes[c.term] = c.box; }});
    xp = 0; bestCombo = 0;
    saveStore();
    renderStart();
    show($('startScreen'));
  }}

  function grade(picked) {{
    if (answered) return;
    var term = current;
    var ok = norm(picked) === norm(challenge.term);
    var cur = boxes[term];
    if (ok) {{
      boxes[term] = Math.min(MAX_BOX, cur + 1);
      combo += 1; if (combo > bestCombo) bestCombo = combo;
      var gain = 10 * (1 + Math.floor(combo / 3));
      xp += gain; sessionXp += gain; correct += 1;
      answers.push({{term: term, correct: true}});
    }} else {{
      boxes[term] = 0; combo = 0; miss += 1;
      var c = byTerm[term];
      if (!misses.some(function (m) {{ return m.term === term; }})) misses.push({{term: term, en: c.en, zh: c.zh}});
      answers.push({{term: term, correct: false, confused: (byTerm[picked] ? picked : '')}});
    }}
    answered = true; lastCorrect = ok; lastPicked = picked; changed = term; dir = ok ? 'up' : 'down';
    saveStore();
    renderPlay();
  }}

  function next() {{
    if (!answered) return;
    if (session.every(function (t) {{ return boxes[t] >= MAX_BOX; }})) {{ finish(); return; }}
    var t = pickNext();
    if (!t) {{ finish(); return; }}
    current = t; challenge = buildChallenge(t); typeValue = ''; answered = false; changed = null;
    renderPlay();
  }}

  function finish() {{
    show($('doneScreen'));
    renderDone();
    renderStart();
  }}

  function chipClass(term, box) {{
    var isCur = term === current;
    var masked = isCur && !answered;
    if (masked) return 'chip current';
    if (term === changed && answered) return dir === 'up' ? 'chip climbed' : 'chip dropped';
    if (box >= MAX_BOX) return 'chip mastered';
    return 'chip';
  }}

  function renderStart() {{
    var due = 0, mastered = 0, weak = 0;
    CARDS.forEach(function (c) {{
      var b = boxes[c.term];
      if (b < MAX_BOX) due += 1; else mastered += 1;
      if (b === 0) weak += 1;
    }});
    $('dueCount').textContent = String(due);
    $('masteredCount').textContent = String(mastered);
    $('weakCount').textContent = String(weak);
    $('xpTotal').textContent = String(xp);
    $('bestComboLabel').textContent = bestCombo > 0 ? '\\u00d7' + bestCombo : '\\u2014';
  }}

  function renderPlay() {{
    $('xpTotal').textContent = String(xp);
    $('bestComboLabel').textContent = bestCombo > 0 ? '\\u00d7' + bestCombo : '\\u2014';

    // ladder board: box MAX_BOX (top) down to 0 (bottom)
    var rungsEl = $('rungs');
    rungsEl.innerHTML = '';
    for (var num = MAX_BOX; num >= 0; num--) {{
      var rung = document.createElement('div');
      rung.className = 'rung' + (num >= MAX_BOX ? ' mastered' : '');
      var numEl = document.createElement('div');
      numEl.className = 'rung-num';
      numEl.textContent = String(num);
      var chipsEl = document.createElement('div');
      chipsEl.className = 'chips';
      CARDS.filter(function (c) {{ return boxes[c.term] === num; }}).forEach(function (c) {{
        var chip = document.createElement('span');
        chip.className = chipClass(c.term, num);
        chip.textContent = (c.term === current && !answered) ? '\\u2022 \\u2022 \\u2022' : c.term;
        chipsEl.appendChild(chip);
      }});
      rung.appendChild(numEl); rung.appendChild(chipsEl);
      rungsEl.appendChild(rung);
    }}
    var clearedCount = session.filter(function (t) {{ return boxes[t] >= MAX_BOX; }}).length;
    $('clearedLabel').textContent = clearedCount + ' / ' + session.length + ' at box ' + MAX_BOX;

    var mult = 1 + Math.floor(combo / 3);
    $('comboLabel').textContent = combo > 0 ? ('\\u00d7' + combo + (mult > 1 ? ' (' + mult + '\\u00d7)' : '')) : '\\u2014';
    $('comboLabel').style.color = combo >= 3 ? 'var(--accent)' : 'var(--ink)';
    $('sessionXp').textContent = String(sessionXp);
    var totalAns = correct + miss;
    $('accuracyLabel').textContent = totalAns ? Math.round((correct / totalAns) * 100) + '%' : '\\u2014';

    var curBox = boxes[current];
    var isRecall = challenge.type === 'type';
    $('kindTag').textContent = isRecall ? 'RECALL \\u00b7 TYPE IT' : (curBox === MASTERED_BOX - 1 ? 'CONFUSABLES' : 'RECOGNISE');
    $('kindTag').className = 'kind-tag' + (isRecall ? ' recall' : '');
    $('boxIndicator').textContent = 'box ' + curBox + ' \\u2192 ' + Math.min(MAX_BOX, curBox + 1);
    var c = byTerm[current];
    $('glossEn').textContent = c.en || '';
    $('glossZh').textContent = c.zh || '';

    $('feedback').classList.add('hidden');
    $('feedback').textContent = '';
    $('nextBtn').disabled = !answered;

    var optionsEl = $('options');
    var typeBlock = $('typeBlock');
    if (isRecall) {{
      optionsEl.classList.add('hidden');
      typeBlock.classList.remove('hidden');
      var input = $('typeInput');
      input.value = '';
      input.disabled = answered;
      input.className = answered ? (lastCorrect ? 'correct' : 'wrong') : '';
      $('submitTypeBtn').disabled = answered;
      if (!answered) setTimeout(function () {{ input.focus(); }}, 0);
    }} else {{
      typeBlock.classList.add('hidden');
      optionsEl.classList.remove('hidden');
      optionsEl.innerHTML = '';
      challenge.options.forEach(function (term, idx) {{
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'opt';
        var letter = String.fromCharCode(65 + idx);
        var mark = '';
        if (answered) {{
          btn.disabled = true;
          if (term === challenge.term) {{ btn.className += ' correct'; mark = '\\u2713'; }}
          else if (term === lastPicked) {{ btn.className += ' wrong'; mark = '\\u2717'; }}
          else {{ btn.className += ' dim'; }}
        }}
        btn.innerHTML = '<span class="letter">' + letter + '</span><span class="term"></span><span class="mark">' + mark + '</span>';
        btn.querySelector('.term').textContent = term;
        btn.addEventListener('click', function () {{ grade(term); }});
        optionsEl.appendChild(btn);
      }});
    }}

    if (answered) {{
      var fb = $('feedback');
      fb.classList.remove('hidden');
      fb.className = 'feedback ' + (lastCorrect ? 'good' : 'bad');
      var headHtml, subHtml = '';
      if (lastCorrect) {{
        headHtml = '\\u2713 ' + challenge.term + ' \\u2014 climbed to box ' + boxes[challenge.term];
      }} else {{
        headHtml = '\\u2717 answer: ' + challenge.term;
        if (lastPicked && lastPicked !== challenge.term) subHtml += 'you said <code>' + escapeHtml(lastPicked) + '</code>';
        if (c.note) subHtml += (subHtml ? '<br/>' : '') + '\\u2260 ' + escapeHtml(c.note);
      }}
      fb.innerHTML = '<div class="head">' + headHtml + '</div>' + (subHtml ? '<div class="sub">' + subHtml + '</div>' : '');
    }}
  }}

  function escapeHtml(s) {{
    return String(s).replace(/[&<>]/g, function (ch) {{ return {{'&': '&amp;', '<': '&lt;', '>': '&gt;'}}[ch]; }});
  }}

  function recordLines() {{
    return answers.map(function (a) {{
      var line = 'glossary-drill record --term "' + a.term + '" ' + (a.correct ? '--correct' : '--wrong');
      if (!a.correct && a.confused && a.confused !== a.term) line += ' --confused-with "' + a.confused + '"';
      return line;
    }}).join('\\n');
  }}

  function renderDone() {{
    var totalAns = correct + miss;
    var pct = totalAns ? Math.round((correct / totalAns) * 100) : 0;
    var doneCleared = session.filter(function (t) {{ return boxes[t] >= MAX_BOX; }}).length;
    $('doneCleared').textContent = String(doneCleared);
    $('doneXp').textContent = '+' + sessionXp;
    $('donePct').textContent = pct + '%';
    $('doneTitle').textContent = pct >= 90 ? 'Locked in.' : (pct >= 60 ? 'Solid progress.' : 'Keep drilling.');
    var list = $('missList');
    list.innerHTML = '';
    if (!misses.length) {{
      var li = document.createElement('li');
      li.textContent = 'clean run \\u2014 no misses \\ud83c\\udf89';
      list.appendChild(li);
    }} else {{
      misses.forEach(function (m) {{
        var li = document.createElement('li');
        li.innerHTML = '<code>' + escapeHtml(m.term) + '</code> \\u2014 ' + escapeHtml(m.en || m.zh || '');
        list.appendChild(li);
      }});
    }}
    $('syncText').value = recordLines();
  }}

  $('startBtn').addEventListener('click', startSession);
  $('againBtn').addEventListener('click', startSession);
  $('resetBtn').addEventListener('click', resetLadder);
  $('resetBtn2').addEventListener('click', resetLadder);
  $('endBtn').addEventListener('click', finish);
  $('nextBtn').addEventListener('click', next);
  $('submitTypeBtn').addEventListener('click', function () {{
    if (!answered && typeValue.trim()) grade(typeValue.trim());
  }});
  $('typeInput').addEventListener('input', function (e) {{ typeValue = e.target.value; }});
  $('typeInput').addEventListener('keydown', function (e) {{
    if (e.key === 'Enter' && !answered && typeValue.trim()) grade(typeValue.trim());
  }});
  $('copySyncBtn').addEventListener('click', function () {{
    var ta = $('syncText'); ta.select();
    try {{ navigator.clipboard.writeText(ta.value); }} catch (e) {{ document.execCommand('copy'); }}
    $('copySyncBtn').textContent = 'Copied \\u2713';
    setTimeout(function () {{ $('copySyncBtn').textContent = 'Copy'; }}, 1200);
  }});
  document.addEventListener('keydown', function (e) {{
    if ($('playScreen').classList.contains('hidden') || challenge.type !== 'mcq') return;
    if (document.activeElement === $('typeInput')) return;
    var k = e.key.toUpperCase();
    if (!answered && k >= 'A' && k <= 'Z') {{
      var idx = k.charCodeAt(0) - 65;
      if (idx < challenge.options.length) grade(challenge.options[idx]);
    }} else if ((e.key === 'Enter' || e.key === ' ') && answered) {{ e.preventDefault(); next(); }}
  }});

  renderStart();
}})();
</script>
</body>
</html>
"""
