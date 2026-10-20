import {
  dateKey,
  summarize,
  estimate,
  type UsageRecord,
  type Prices,
  type Filters,
} from '../model.ts';
import {
  element,
  input,
  set,
  node,
  compact,
  exact,
  money,
  share,
  shortProject,
  group,
} from './dom.ts';
export function createCharts(options: {
  prices: () => Prices;
  filters: () => Filters;
  inspect: (records: UsageRecord[], title: string) => void;
  select: (fields: Record<string, string>) => void;
}) {
  function tooltip(text: string, event: MouseEvent) {
    const tip = element('tooltip');
    tip.textContent = text;
    tip.hidden = false;
    tip.style.left = Math.min(event.clientX + 12, window.innerWidth - 270) + 'px';
    tip.style.top =
      Math.max(8, Math.min(event.clientY + 12, window.innerHeight - tip.offsetHeight - 12)) + 'px';
  }
  function renderTrend(records: UsageRecord[]) {
    const prices = options.prices();
    const container = element('trend');
    container.replaceChildren();
    const measure = input('measure').value;
    const daily = group(records, (r) => dateKey(r.at, options.filters().timezone));
    if (!daily.size) {
      container.append(node('p', 'No usage matches these filters.', 'empty'));
      element('legend').replaceChildren();
      return;
    }
    const days = [...daily.keys()].sort();
    const span = (Date.parse(days[days.length - 1]) - Date.parse(days[0])) / 86400000 + 1;
    // Use a weekly chart for broad ranges; group totals remain exact and drilldown contains all days.
    const width = Math.max(260, Math.min(1000, container.clientWidth)),
      height = 230,
      left = 55,
      right = 12,
      top = 10,
      bottom = 30;
    const plotWidth = width - left - right,
      plotHeight = height - top - bottom;
    const bucketDays = span > 90 ? 7 : 1;
    const first = Date.parse(days[0]);
    const buckets = new Map<number, UsageRecord[]>();
    for (const [day, rows] of daily) {
      const index = Math.floor((Date.parse(day) - first) / 86400000 / bucketDays);
      buckets.set(index, [...(buckets.get(index) ?? []), ...rows]);
    }
    const count = Math.ceil(span / bucketDays);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${bucketDays === 7 ? 'Weekly' : 'Daily'} ${measure} chart`);
    const svgNode = (tag: string, attrs: Record<string, string | number>) => {
      const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      svg.append(e);
      return e;
    };
    const values = [...buckets.values()].map((rows) => {
      const s = summarize(rows, prices);
      return measure === 'reasoning'
        ? (s.reasoningShare ?? 0) * 100
        : measure === 'tokens'
          ? s.total
          : measure === 'events'
            ? s.events
            : s.knownCost;
    });
    const max = measure === 'reasoning' ? 100 : Math.max(...values, 1);
    for (let i = 0; i <= 4; i++) {
      const y = top + plotHeight * (1 - i / 4);
      svgNode('line', { x1: left, x2: width - right, y1: y, y2: y, stroke: '#e8eee7' });
      const label = svgNode('text', { x: left - 8, y: y + 4, 'text-anchor': 'end' });
      label.textContent =
        measure === 'reasoning'
          ? ((max * i) / 4).toFixed(0) + '%'
          : measure === 'cost'
            ? money((max * i) / 4)
            : compact((max * i) / 4);
    }
    const barWidth = Math.max(0.6, (plotWidth / count) * 0.72);
    for (const [index, rows] of buckets) {
      const s = summarize(rows, prices);
      const x = left + ((index + 0.5) * plotWidth) / count - barWidth / 2;
      let offset = 0;
      const components =
        measure === 'tokens'
          ? ([
              [s.tokens.input - s.tokens.cached - s.tokens.write, '#347353'],
              [s.tokens.cached, '#83b79a'],
              [s.tokens.write, '#d4ae64'],
              [s.tokens.output - s.tokens.reasoning, '#b3a6c8'],
              [s.tokens.reasoning, '#8070a2'],
            ] as const)
          : ([
              [
                measure === 'reasoning'
                  ? (s.reasoningShare ?? 0) * 100
                  : measure === 'events'
                    ? s.events
                    : s.knownCost,
                '#347353',
              ],
            ] as const);
      for (const [value, color] of components) {
        if (!value) continue;
        const h = (value / max) * plotHeight;
        const date = new Date(first + index * bucketDays * 86400000).toISOString().slice(0, 10);
        const rect = svgNode('rect', {
          x,
          y: top + plotHeight - offset - h,
          width: barWidth,
          height: h,
          fill: color,
          'data-day': date,
          tabindex: 0,
          role: 'button',
          'aria-label': `${date}: ${compact(s.total)} tokens, inspect usage`,
        });
        offset += h;
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${date}${bucketDays === 7 ? ' · 7-day bucket' : ''}\n${exact(s.total)} tokens\n${share(s.reasoningShare)} reasoning / output${s.missingReasoning ? ' (lower bound)' : ''}\n${exact(s.events)} events\n${s.priced ? s.priced + '/' + s.events + ' priced · ' + money(s.knownCost) : 'Unpriced'}`;
        rect.append(title);
        rect.addEventListener('mousemove', (e) => tooltip(title.textContent ?? '', e));
        rect.addEventListener('mouseleave', () => {
          element('tooltip').hidden = true;
        });
        rect.addEventListener('click', () => options.inspect(rows, 'Usage · ' + date));
        rect.addEventListener('keydown', (e) => {
          if (e instanceof KeyboardEvent && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            options.inspect(rows, 'Usage · ' + date);
          }
        });
      }
    }
    for (const [i, day] of days.entries()) {
      if (
        i !== 0 &&
        i !== days.length - 1 &&
        i % Math.max(1, Math.ceil(days.length / (width < 500 ? 3 : 5)))
      )
        continue;
      const x = left + ((Date.parse(day) - first) / 86400000 / span) * plotWidth;
      const label = svgNode('text', {
        x: Math.min(x, width - 35),
        y: height - 5,
        'text-anchor': i === 0 ? 'start' : 'middle',
      });
      label.textContent = day.slice(5);
    }
    container.append(svg);
    const legend = element('legend');
    legend.replaceChildren();
    const entries =
      measure === 'tokens'
        ? [
            ['Uncached input', '#347353'],
            ['Cache read', '#83b79a'],
            ['Cache write', '#d4ae64'],
            ['Visible output', '#b3a6c8'],
            ['Reasoning output', '#8070a2'],
          ]
        : [
            [
              measure === 'reasoning'
                ? 'Recorded reasoning ÷ output · %'
                : measure === 'cost'
                  ? 'Priced subtotal · USD'
                  : 'Usage events',
              '#347353',
            ],
          ];
    for (const [text, color] of entries) {
      const item = node('span');
      const swatch = node('i');
      swatch.style.background = color;
      item.append(swatch, document.createTextNode(text));
      legend.append(item);
    }
    if (bucketDays === 7) legend.append(node('span', '7-day buckets'));
    if (measure === 'cost' && records.some((r) => estimate(r, prices) === null))
      legend.append(node('span', 'Unpriced events excluded from cost bars'));
  }
  function renderHeatmap(records: UsageRecord[]) {
    const prices = options.prices();
    const daily = group(records, (r) => dateKey(r.at, options.filters().timezone));
    const end =
      options.filters().to || dateKey(new Date().toISOString(), options.filters().timezone);
    const endTime = Date.parse(end + 'T12:00:00Z');
    const startTime = endTime - 181 * 86400000;
    const startDay = new Date(startTime).toISOString().slice(0, 10);
    set('activity-caption', 'Last 182 days ending ' + end + ' · current filters');
    set('heat-start', startDay);
    set('heat-end', end);
    const container = element('heatmap');
    container.replaceChildren();
    const maxima = Math.max(1, ...[...daily.values()].map((r) => summarize(r, prices).total));
    const colors = ['#edf1ec', '#d0e5d5', '#94bfa3', '#57956d', '#276344'];
    let week: HTMLElement | null = null;
    const padding = new Date(startTime).getUTCDay();
    for (let i = -padding; i < 182; i++) {
      if (!week || (i + padding) % 7 === 0) {
        week = node('div', '', 'week');
        container.append(week);
      }
      const day = new Date(startTime + i * 86400000).toISOString().slice(0, 10);
      const rows = i < 0 ? [] : (daily.get(day) ?? []);
      const total = summarize(rows, prices).total;
      const b = document.createElement('button');
      b.type = 'button';
      b.style.background = colors[total ? Math.max(1, Math.ceil((total / maxima) * 4)) : 0];
      b.title = `${day} · ${exact(total)} tokens`;
      b.setAttribute('aria-label', b.title);
      b.disabled = !rows.length;
      if (i < 0) b.style.visibility = 'hidden';
      b.addEventListener('click', () => {
        options.select({ from: day, to: day });
      });
      week.append(b);
    }
  }
  function renderBreakdown(
    records: UsageRecord[],
    id: string,
    key: 'model' | 'project' | 'effort',
  ) {
    const prices = options.prices();
    const entries = [...group(records, (r) => r[key])]
      .map(([name, rows]) => ({
        name,
        summary: summarize(rows, prices),
        total: summarize(rows, prices).total,
      }))
      .sort((a, b) => b.total - a.total);
    const container = element(id);
    container.replaceChildren();
    if (!entries.length) {
      container.append(node('p', 'No matching usage.', 'empty'));
      return;
    }
    const max = entries[0].total;
    for (const e of entries.slice(0, 8)) {
      const row = node('div', '', 'bar-row');
      const b = node('button');
      b.title = e.name;
      const label = node('span', key === 'project' ? shortProject(e.name) : e.name, 'bar-name');
      b.append(label, node('span', compact(e.total)));
      b.addEventListener('click', () => {
        options.select({ [key]: e.name });
      });
      const track = node('div', '', 'bar-track');
      const fill = node('div', '', 'bar-fill');
      fill.style.width = (e.total / max) * 100 + '%';
      track.append(fill);
      row.append(
        b,
        track,
        node(
          'span',
          `${share(e.summary.reasoningShare)} reasoning / output${e.summary.missingReasoning ? ' · lower bound' : ''}`,
          'caption',
        ),
      );
      container.append(row);
    }
    if (entries.length > 8)
      container.append(
        node('span', `Top 8 of ${entries.length}. Use the filter to select any ${key}.`, 'caption'),
      );
  }

  return {
    trend: renderTrend,
    render(records: UsageRecord[]) {
      renderTrend(records);
      renderHeatmap(records);
      renderBreakdown(records, 'models', 'model');
      renderBreakdown(records, 'projects', 'project');
      renderBreakdown(records, 'efforts', 'effort');
    },
  };
}
