import { actors, sequence, unseenDestination, type Phase, type SequenceRow } from './sequence.ts';
import type { Run } from './contracts.ts';
import type { Observation } from './observability.ts';
export function el<T extends HTMLElement>(id: string, type: { new (): T }): T {
  const n = document.getElementById(id);
  if (!(n instanceof type)) throw new Error(`Missing ${id}`);
  return n;
}
export const text = (id: string, value: string) => {
  el(id, HTMLElement).textContent = value;
};
export const button = (id: string) => el(id, HTMLButtonElement);
export const select = (id: string) => el(id, HTMLSelectElement);
export const escape = (value: string | number | null | undefined) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
let rows: SequenceRow[] = [],
  records: readonly Observation[] = [],
  pinned: string | undefined,
  tipAnchor: HTMLElement | undefined;
const dialog = el('detail', HTMLDialogElement);
export function openDialog(title: string, html: string) {
  hideTip();
  pinned = undefined;
  text('detail-title', title);
  el('detail-body', HTMLDivElement).innerHTML = html;
  if (!dialog.open) dialog.showModal();
}
export function closeDialog() {
  pinned = undefined;
  dialog.close();
}
button('detail-close').onclick = closeDialog;
dialog.onclose = () => {
  pinned = undefined;
};
function rowFor(key: string) {
  return rows.find((r) => r.key === key);
}
function payload(key: string) {
  const row = rowFor(key),
    e = row?.event ?? records.find((e) => e.key === key);
  if (!e) return '';
  return `<p>${escape(e.source)} capture · ${escape(e.provenance)} · ${escape(e.connectionId)}</p><dl><dt>Event / wire ID</dt><dd>${e.sequence} / ${escape(e.requestId ?? 'none')}</dd><dt>Method</dt><dd>${escape(e.method)}</dd><dt>Capture time</dt><dd>${escape(e.time)}</dd><dt>Interval</dt><dd>${e.elapsedMs === undefined ? 'Not recorded' : `${e.elapsedMs} ms on this connection`}</dd></dl>${row?.stream.length ? `<p>${row.stream.length} captured input updates. This is the latest arguments snapshot; raw notifications remain in the log.</p>` : ''}<pre>${escape(e.payload)}</pre>`;
}
function pin(key: string) {
  openDialog('Protocol payload', payload(key));
  pinned = key;
}
function hideTip() {
  tipAnchor?.removeAttribute('aria-describedby');
  tipAnchor = undefined;
  el('payload-tip', HTMLDivElement).hidden = true;
}
function showTip(target: HTMLElement, body: string) {
  hideTip();
  tipAnchor = target;
  target.setAttribute('aria-describedby', 'payload-tip');
  const tip = el('payload-tip', HTMLDivElement);
  tip.innerHTML = body;
  tip.hidden = false;
  const b = target.getBoundingClientRect();
  tip.style.left = `${Math.max(10, Math.min(b.left, innerWidth - tip.offsetWidth - 10))}px`;
  tip.style.top = `${Math.max(10, b.top - tip.offsetHeight - 8)}px`;
}
export function bindPreviews(recordedInput: () => string) {
  const main = el('workspace', HTMLElement);
  function preview(event: Event) {
    if (!(event.target instanceof HTMLElement)) return;
    const target = event.target.closest<HTMLElement>('[data-event], [data-role], #recorded-input');
    if (!target) return;
    if (target.dataset.event) {
      const r = rowFor(target.dataset.event),
        e = r?.event ?? records.find((e) => e.key === target.dataset.event);
      if (e)
        showTip(
          target,
          `<b>${escape(e.method)}</b><pre>${escape(e.payload)}</pre><small>Click/tap to pin · ${escape(e.provenance)}</small>`,
        );
    } else if (target.dataset.role) {
      showTip(target, escape(actors.find((a) => a.id === target.dataset.role)?.detail));
    } else showTip(target, `<b>Original input</b><pre>${escape(recordedInput())}</pre>`);
  }
  main.addEventListener('focusin', preview);
  main.addEventListener('pointerover', preview);
  main.addEventListener('pointerout', hideTip);
  main.addEventListener('focusout', hideTip);
  main.addEventListener('click', (event) => {
    if (event.target instanceof HTMLElement) {
      const key = event.target.closest<HTMLElement>('[data-event]')?.dataset.event;
      if (key) pin(key);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideTip();
  });
  window.addEventListener('scroll', hideTip, true);
}
export function renderGraph(
  run: Run | undefined,
  events: readonly Observation[],
  focus: Phase,
  host: string,
) {
  records = events;
  rows = run ? sequence(events, run) : [];
  text(
    'order-note',
    run?.mode === 'fixture'
      ? 'Illustrated sequence ↓'
      : rows.some((r) => r.inferredOrder)
        ? 'Correlated sequence ↓ · host ordering inferred'
        : 'Receipt order ↓ · no cross-source order inferred',
  );
  const destination = unseenDestination(run),
    applicable = (r: SequenceRow) => focus === 'all' || r.phase === focus;
  el('actors', HTMLDivElement).innerHTML = actors
    .map((a) => {
      const active = rows.some((r) => applicable(r) && (r.from === a.id || r.to === a.id));
      return `<div class="${!active && a.id !== 'conversation' ? 'inactive' : ''}"><strong tabindex="0" data-role="${a.id}">${escape(a.id === 'host' ? host : a.name)}</strong><small>${active ? '' : a.id === 'conversation' && destination ? 'Not observed' : 'Inactive here'}</small></div>`;
    })
    .join('');
  const node = el('sequence', HTMLDivElement),
    width = node.clientWidth || 700,
    margin = 32,
    space = width - margin,
    height = Math.max(180, (rows.length + (destination ? 1 : 0)) * 60 + 20),
    x = (id: string) => margin + (space * (actors.findIndex((a) => a.id === id) + 0.5)) / 4;
  node.style.height = `${height}px`;
  let svg = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>${actors.map((a) => `<line class="lifeline" x1="${x(a.id)}" x2="${x(a.id)}" y1="0" y2="${height}"/>`).join('')}`;
  rows.forEach((r, i) => {
    const from = x(r.from),
      to = x(r.to),
      y = i * 60 + 33;
    svg += `<g opacity="${applicable(r) ? 1 : 0.18}">${from === to ? `<path d="M ${from} ${y - 4} h 17 v 8 h -17"` : `<path d="M ${from} ${y} H ${to}"`} class="arrow ${r.event.status.includes('error') ? 'error' : r.event.kind === 'response' ? 'response' : ''}" marker-end="url(#arrow)"/></g>`;
  });
  if (destination)
    svg += `<path class="arrow unseen" d="M ${x('host')} ${rows.length * 60 + 33} H ${x('conversation')}" marker-end="url(#arrow)"/>`;
  svg += '</svg>';
  const focused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement.dataset.event
      : undefined;
  node.innerHTML =
    svg +
    rows
      .map(
        (r, i) =>
          `<div class="event-row ${applicable(r) ? '' : 'dim'}" style="top:${i * 60}px"><span class="event-no">${i + 1}</span><button data-event="${escape(r.key)}" class="event-button" style="left:${(x(r.from) + x(r.to)) / 2}px" aria-label="${escape(`${r.label} · ${r.from} to ${r.to}`)}">${escape(r.label)}</button><span class="event-caption" style="left:${(x(r.from) + x(r.to)) / 2}px">${escape(r.event.kind)} · ${escape(r.event.source)}</span></div>`,
      )
      .join('') +
    (destination
      ? `<div class="event-row unobserved" style="top:${rows.length * 60}px"><span class="event-button" style="left:${(x('host') + x('conversation')) / 2}px">${escape(destination)}</span></div>`
      : '') +
    (!rows.length ? '<p class="empty">Captured events appear here as they arrive.</p>' : '');
  if (focused)
    [...node.querySelectorAll<HTMLButtonElement>('[data-event]')]
      .find((b) => b.dataset.event === focused)
      ?.focus({ preventScroll: true });
  if (pinned) {
    el('detail-body', HTMLDivElement).innerHTML =
      payload(pinned) || '<p>This event has been evicted from the bounded log.</p>';
  }
  text(
    'event-count',
    run
      ? `${run.mode === 'fixture' ? 'Fixture' : `Run ${run.ordinal}`} · ${rows.length} events`
      : 'No interaction selected',
  );
}
export function renderLog(events: readonly Observation[], run: Run | undefined, filter: string) {
  records = events;
  const selected = events.filter(
    (e) =>
      filter === 'session' ||
      (filter === 'housekeeping' ? e.observer || !e.runId : e.runId === run?.id && !e.observer),
  );
  text(
    'log-help',
    filter === 'housekeeping'
      ? 'Resize notifications and observer calls keep the panel and evidence collection running. Inspect them when sizing or refresh fails. They do not explain the selected tool result.'
      : 'These are the records behind the sequence. Capture order and wire IDs belong to each source; receipt order does not prove cross-source timing.',
  );
  el('log-records', HTMLDivElement).innerHTML =
    `<table><thead><tr><th>Receipt</th><th>Event</th><th>Source</th><th>Kind</th></tr></thead><tbody>${selected.map((e) => `<tr><td>${e.received}</td><td><button data-event="${escape(e.key)}">${escape(e.method)}</button></td><td>${escape(e.source)} · ${escape(e.provenance)}</td><td>${escape(e.kind)}</td></tr>`).join('')}</tbody></table>${selected.length ? '' : '<p>No records in this filter.</p>'}`;
}
export function explainRoles() {
  openDialog(
    'Four roles, two visible surfaces',
    `<p>These are roles, not four processes. The conversation is the visible exchange; the model generates assistant responses. The app panel is not another assistant.</p>${actors.map((a) => `<h3>${a.name}</h3><p>${a.detail}</p>`).join('')}<p>Tool: App panel → Host → MCP server → back.</p><p>Message: App panel → Host → Main conversation. Delivery and model work are outside this app’s capture.</p>`,
  );
}
