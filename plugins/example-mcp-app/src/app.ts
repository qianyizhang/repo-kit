import { App, PostMessageTransport, applyDocumentTheme } from '@modelcontextprotocol/ext-apps';
import { z } from 'zod';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { TraceLog, observedTransport, boundedPayload } from './trace.ts';
import { serverIdentitySchema, snapshotSchema, type JourneyId, type Run } from './contracts.ts';
import { journeys, makeFixture, type Scenario } from './journeys.ts';
import { Observations, type Observation } from './observability.ts';
import { type Phase } from './sequence.ts';
import {
  el,
  text,
  button,
  select,
  escape,
  openDialog,
  closeDialog,
  renderGraph,
  renderLog,
  bindPreviews,
  explainRoles,
} from './view.ts';
declare const EXAMPLE_BUILD: string;
const panelId = crypto.randomUUID(),
  hostAvailable = window.parent !== window;
let mode: 'fixture' | 'live' = hostAvailable ? 'live' : 'fixture',
  journey: JourneyId = 'startup',
  scenario: Scenario = 'success',
  focus: Phase = 'all';
let connection = hostAvailable ? 'Connecting' : 'No host',
  busy = false,
  ordinal = 0,
  scheduled = false,
  serverInstance = '',
  serverBuild = '',
  serverDropped = 0,
  diagnostic = '',
  exportStatus = '';
const liveRuns: Run[] = [],
  fixtures = new Map<JourneyId, ReturnType<typeof makeFixture>>(),
  selectedRuns = new Map<JourneyId, string>(),
  drafts = new Map<JourneyId, string>(),
  steps = new Map<string, number>(),
  checked = new Set<string>();
const observations = new Observations();
const lifetime = new AbortController(),
  options = { timeout: 10000, signal: lifetime.signal };
let refreshFlight: Promise<void> | undefined, poll: ReturnType<typeof setTimeout> | undefined;
let capturePending = false,
  infoRevision = 0;
const toolCatalog = z
  .array(z.object({ name: z.string(), description: z.string().optional() }).passthrough())
  .parse(JSON.parse(document.getElementById('tool-catalog')?.textContent ?? '[]'));
const log = new TraceLog('app', () => {
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      observations.ingest('app', panelId, log.events);
      renderEvidence();
    });
  }
});
const app = new App(
  { name: 'Example MCP App', version: '0.4.0' },
  { availableDisplayModes: ['inline', 'fullscreen'] },
  { autoResize: true, strict: true },
);
const actions = ['resource', 'tool', 'context', 'message'] as const;
function currentRun() {
  return mode === 'fixture'
    ? fixtures.get(journey)?.run
    : liveRuns.find((r) => r.id === selectedRuns.get(journey));
}
function input() {
  return el('demo-text', HTMLInputElement).value;
}
function fixtureEvents(): Observation[] {
  const store = new Observations();
  const events = fixtures.get(journey)?.events ?? [];
  for (const event of events) store.ingest(event.source, 'fixture', [event]);
  return [...store.all()];
}
function evidence() {
  return mode === 'fixture' ? fixtureEvents() : observations.all();
}
function activeAction(): JourneyId {
  return journey === 'investigate'
    ? currentRun()?.status === 'waiting'
      ? actions[steps.get(currentRun()?.id ?? '') ?? 0]!
      : 'resource'
    : journey;
}
function liveBlockReason(): string | undefined {
  if (mode === 'fixture') return;
  if (!hostAvailable) return 'Open the installed MCP App in a supporting host to run live.';
  if (connection !== 'Connected') return `Live unavailable: ${connection.toLowerCase()}.`;
  if (serverBuild && serverBuild !== EXAMPLE_BUILD)
    return 'Build mismatch. Reconnect the server and reopen the panel.';
  const operation = activeAction(),
    caps = app.getHostCapabilities();
  const allowed =
    operation === 'teardown' ||
    (operation === 'context'
      ? caps?.updateModelContext
      : operation === 'message'
        ? caps?.message
        : operation === 'resource'
          ? caps?.serverResources
          : caps?.serverTools);
  if (!allowed) return 'This host did not advertise the required capability.';
  const run = currentRun();
  if (
    run?.status === 'uncertain' &&
    ['message', 'investigate'].includes(journey) &&
    !checked.has(run.id)
  )
    return 'Check the main conversation before considering another send.';
}
function variants(): [Scenario, string][] {
  if (journey === 'tool')
    return [
      ['success', 'Success'],
      ['tool-error', 'Tool error'],
      ...(mode === 'fixture' ? [['missing-trace', 'Missing trace'] as [Scenario, string]] : []),
    ];
  if (journey === 'resource')
    return [
      ['success', 'Found'],
      ['protocol-error', 'Not found'],
    ];
  if (mode === 'fixture' && (journey === 'message' || journey === 'investigate'))
    return [
      ['success', 'Acknowledged'],
      ['rejected', 'Rejected'],
      ['timeout', 'No reply'],
    ];
  return [['success', 'Success']];
}
function controls() {
  const run = currentRun(),
    reason = liveBlockReason();
  text(
    'availability',
    reason ??
      (mode === 'fixture'
        ? 'Authored sequence. No host or server calls.'
        : activeAction() === 'message'
          ? 'Sends this text to the owning conversation.'
          : activeAction() === 'teardown'
            ? 'Export first. The host may remove this panel.'
            : 'Actual SDK calls; no fixture fallback.'),
  );
  button('run').disabled = busy || Boolean(reason);
  button('run').textContent = busy
    ? 'Running…'
    : mode === 'fixture'
      ? 'Apply text / replay'
      : journey === 'startup'
        ? 'Refresh connection evidence'
        : journey === 'investigate'
          ? journeys[activeAction()].button
          : journeys[journey].button;
  button('live-mode').disabled = busy || !hostAvailable;
  button('fixture-mode').disabled = busy;
  button('live-mode').setAttribute('aria-pressed', String(mode === 'live'));
  button('fixture-mode').setAttribute('aria-pressed', String(mode === 'fixture'));
  el('demo-text', HTMLInputElement).disabled = busy;
  select('history').disabled = busy;
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-journey],[data-variant]'))
    b.disabled = busy;
  button('refresh').disabled =
    busy ||
    mode === 'fixture' ||
    connection !== 'Connected' ||
    !app.getHostCapabilities()?.serverTools;
  text(
    'connection',
    mode === 'fixture'
      ? 'ⓘ Fixture · app info'
      : `ⓘ ${connection} · ${app.getHostVersion()?.name ?? 'Host'}`,
  );
  button('capture').disabled =
    capturePending ||
    busy ||
    mode !== 'live' ||
    !z.uuid().safeParse(run?.id).success ||
    connection !== 'Connected' ||
    serverBuild !== EXAMPLE_BUILD ||
    !app.getHostCapabilities()?.serverTools;
  text(
    'mode-note',
    mode === 'fixture'
      ? 'Fixture outcomes redraw the example in place.'
      : journey === 'tool' || journey === 'resource'
        ? 'Choose an operation case; the result comes from the server.'
        : 'The host determines the outcome. No simulated live variants.',
  );
  const check = button('check-conversation');
  check.hidden =
    !run ||
    busy ||
    !['message', 'investigate'].includes(journey) ||
    !['success', 'uncertain'].includes(run.status);
  check.textContent = run && checked.has(run.id) ? 'Conversation checked' : 'Check conversation';
}
function renderPage() {
  const d = journeys[journey];
  text('journey-title', d.title);
  text('description', d.description);
  el('input-label', HTMLDivElement).hidden = !d.input;
  el('demo-text', HTMLInputElement).value =
    drafts.get(journey) ??
    (journey === 'message' || journey === 'investigate'
      ? 'Explain what this evidence tells us.'
      : 'Hello from the MCP App');
  const choices = variants();
  if (!choices.some(([id]) => id === scenario)) scenario = 'success';
  el('variants', HTMLDivElement).innerHTML =
    choices.length > 1
      ? `<span class="small muted">${mode === 'fixture' ? 'Outcome' : 'Operation case'}</span>` +
        choices
          .map(
            ([id, label]) =>
              `<button data-variant="${id}" aria-pressed="${scenario === id}">${label}</button>`,
          )
          .join('')
      : '';
  el('phase-focus', HTMLDivElement).hidden = journey !== 'investigate';
  el('phase-focus', HTMLDivElement).innerHTML = (
    [
      ['all', 'Whole journey'],
      ['resource', 'Resource'],
      ['tool', 'Tool'],
      ['context', 'Context'],
      ['message', 'Message'],
    ] as const
  )
    .map(
      ([id, label]) =>
        `<button data-phase="${id}" aria-pressed="${focus === id}">${label}</button>`,
    )
    .join('');
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-journey]'))
    b.setAttribute('aria-current', b.dataset.journey === journey ? 'page' : 'false');
  controls();
  renderEvidence();
}
function renderEvidence() {
  const run = currentRun(),
    all = evidence(),
    status: Record<Run['status'], string> = {
      running: 'In progress',
      waiting: 'Next step',
      success: 'Succeeded',
      error: 'Failed',
      uncertain: 'Not confirmed',
      closed: 'Cleanup acknowledged',
    };
  el('outcome', HTMLDivElement).innerHTML = run
    ? `<b>${mode === 'fixture' ? 'Example · ' : ''}${status[run.status]}</b>${escape(run.summary)}`
    : 'No interaction yet.';
  renderGraph(
    run,
    all,
    focus,
    mode === 'fixture' ? 'Host' : (app.getHostVersion()?.name ?? 'Host'),
  );
  const history = liveRuns.filter((r) => r.journey === journey).toReversed();
  el('history-label', HTMLLabelElement).hidden = mode === 'fixture' || history.length < 2;
  select('history').replaceChildren(
    ...history.map((r) => new Option(`Run ${r.ordinal} · ${status[r.status]}`, r.id)),
  );
  if (run) select('history').value = run.id;
  const missing =
    run &&
    ['tool', 'resource', 'investigate'].includes(run.journey) &&
    run.status !== 'running' &&
    !all.some((e) => e.source === 'server' && e.runId === run.id);
  el('evidence-problem', HTMLDivElement).hidden = mode === 'fixture' || (!diagnostic && !missing);
  text(
    'diagnostic-status',
    diagnostic ||
      (missing
        ? 'Server trace missing. Refresh retrieves evidence without repeating the action.'
        : ''),
  );
  text(
    'log-count',
    `${all.length} records · ${mode === 'fixture' ? 0 : observations.dropped} view evictions${exportStatus ? ' · ' + exportStatus : ''}`,
  );
  if (!el('event-log', HTMLElement).hidden) renderLog(all, run, select('log-filter').value);
}
function connectionDetails() {
  const revision = ++infoRevision;
  openDialog(
    'App info',
    `<p>Host identity, capabilities and installed build. The existing scenarios explain each conversation/tool route; selecting a sequence event shows its frozen payload.</p><button id="tool-contracts">Tools and API contracts</button><pre>${escape(boundedPayload({ panelId, connection, mode, appBuild: EXAMPLE_BUILD, serverBuild, serverInstance, evicted: { view: observations.dropped, app: log.dropped, server: serverDropped }, host: app.getHostVersion(), capabilities: app.getHostCapabilities(), visibility: 'App and server transport observations; no host internals or model execution.' }))}</pre><p id="recording-info">${mode === 'fixture' ? 'Fixture mode makes no host calls. Standalone has no server or disk writer; session export is explicit. Live servers persist metadata by default under the canonical MCP App log root.' : 'Reading recording health…'}</p>`,
  );
  button('tool-contracts').onclick = () =>
    openDialog(
      'Tools and API contracts',
      `<p>${toolCatalog.length} tools, generated from this build’s actual MCP registrations. App-only snapshots feed the graph; conversation reads use summaries or one exact event.</p>${toolCatalog.map((tool) => `<details><summary>${escape(tool.name)}</summary><p>${escape(tool.description)}</p><pre>${escape(JSON.stringify(tool, null, 2))}</pre></details>`).join('')}`,
    );
  if (mode === 'live' && connection === 'Connected' && app.getHostCapabilities()?.serverTools)
    void app
      .callServerTool({ name: 'diagnostics_info', arguments: {} }, options)
      .then((result) => {
        const target = document.getElementById('recording-info');
        if (revision !== infoRevision || !target) return;
        target.textContent = result.isError
          ? 'Recording status unavailable.'
          : JSON.stringify(result.structuredContent, null, 2);
      })
      .catch((error) => {
        const target = document.getElementById('recording-info');
        if (revision === infoRevision && target)
          target.textContent = `Recording status unavailable: ${String(error)}`;
      });
}
async function refreshServer() {
  if (refreshFlight) return refreshFlight;
  if (lifetime.signal.aborted || !app.getHostCapabilities()?.serverTools) return;
  refreshFlight = (async () => {
    const response = await app.callServerTool(
      { name: 'example_trace', arguments: {} },
      { ...options, timeout: 3000 },
    );
    if (lifetime.signal.aborted) return;
    if (response.isError) throw new Error('Server rejected evidence read');
    const identity = serverIdentitySchema.parse(response.structuredContent);
    serverBuild = identity.build;
    if (serverBuild !== EXAMPLE_BUILD) throw new Error('Build mismatch. Reconnect and reopen.');
    const snapshot = snapshotSchema.parse(response.structuredContent);
    serverInstance = snapshot.instance;
    serverDropped = snapshot.dropped;
    observations.ingest('server', serverInstance, snapshot.events);
    diagnostic = '';
    renderEvidence();
    controls();
  })().finally(() => {
    refreshFlight = undefined;
  });
  return refreshFlight;
}
async function publishReport() {
  if (
    lifetime.signal.aborted ||
    mode !== 'live' ||
    connection !== 'Connected' ||
    !app.getHostCapabilities()?.serverTools
  )
    return;
  const response = await app.callServerTool(
    {
      name: 'example_report',
      arguments: {
        report: {
          panelId,
          build: EXAMPLE_BUILD,
          host: app.getHostVersion() ?? { name: 'Unknown', version: 'unknown' },
          mode,
          connection,
          runs: liveRuns,
          events: log.events.filter((e) => !e.observer),
          dropped: log.dropped,
        },
      },
    },
    options,
  );
  if (response.isError) throw new Error('Server rejected app evidence report');
}
async function syncEvidence() {
  try {
    await refreshServer();
    await publishReport();
  } catch (error) {
    if (!lifetime.signal.aborted) diagnostic = `Evidence collection failed: ${String(error)}`;
  }
  renderEvidence();
}
function schedulePoll() {
  poll = setTimeout(() => {
    if (!busy || lifetime.signal.aborted) return;
    void refreshServer()
      .catch((error) => {
        if (!lifetime.signal.aborted) diagnostic = `Evidence collection failed: ${String(error)}`;
      })
      .finally(() => {
        if (busy && !lifetime.signal.aborted) schedulePoll();
      });
  }, 350);
}
function startRun(id: string = crypto.randomUUID()): Run {
  const run: Run = {
    id,
    ordinal: ++ordinal,
    journey,
    scenario,
    input: journeys[journey].input ? input() : '',
    mode: 'live',
    status: 'running',
    summary: 'Waiting for a response.',
    result: '',
    startedAt: new Date().toISOString(),
  };
  liveRuns.push(run);
  if (liveRuns.length > 30) {
    const evicted = liveRuns.shift()!;
    steps.delete(evicted.id);
    checked.delete(evicted.id);
  }
  selectedRuns.set(journey, id);
  return run;
}
async function perform(operation: JourneyId, run: Run) {
  if (operation === 'tool') {
    const result = await app.callServerTool(
      {
        name: 'example_echo',
        arguments: { text: run.input, fail: run.scenario === 'tool-error', runId: run.id },
      },
      options,
    );
    return {
      result,
      failed: Boolean(result.isError),
      summary: result.isError
        ? 'Tool error returned: JSON-RPC completed with isError: true.'
        : 'The server echoed your text.',
    };
  }
  if (operation === 'resource') {
    const result = await app.readServerResource(
      {
        uri: `example://sample/${run.scenario === 'protocol-error' ? 'missing' : 'run'}/${run.id}`,
      },
      options,
    );
    return { result, failed: false, summary: 'JSON resource returned through the host.' };
  }
  if (operation === 'context') {
    const result = await app.updateModelContext(
      { content: [{ type: 'text', text: run.input }] },
      options,
    );
    return {
      result,
      failed: false,
      summary: 'Context acknowledged. No model turn requested; model use is not observed.',
    };
  }
  if (operation === 'message') {
    const result = await app.sendMessage(
      { role: 'user', content: [{ type: 'text', text: run.input }] },
      options,
    );
    return {
      result,
      failed: Boolean(result.isError),
      summary: result.isError
        ? 'The host rejected the message.'
        : 'Host acknowledged. Check this conversation for actual arrival and any response.',
    };
  }
  log.teardownRun = run.id;
  await app.requestTeardown();
  return {
    result: { request: 'sent' },
    failed: false,
    summary: 'Closure requested. The host owns cleanup and removal.',
  };
}
async function execute() {
  if (busy) return;
  if (mode === 'fixture') {
    fixtures.set(journey, makeFixture(journey, scenario, input()));
    renderEvidence();
    controls();
    return;
  }
  if (liveBlockReason()) return;
  const previous = currentRun();
  if (journey === 'teardown') {
    openDialog(
      'Ready to close?',
      `<p>Confirm the exported file arrived, or choose to close without it.</p><label><input type="checkbox" id="close-ack"> I have the file, or I accept losing this session.</label><p><button id="confirm-close" disabled>Request closure</button></p>`,
    );
    el('close-ack', HTMLInputElement).onchange = () => {
      button('confirm-close').disabled = !el('close-ack', HTMLInputElement).checked;
    };
    button('confirm-close').onclick = () => {
      closeDialog();
      void runLive();
    };
    return;
  }
  if (previous?.status === 'uncertain' && ['message', 'investigate'].includes(journey)) {
    openDialog(
      journey === 'investigate' ? 'Restart the journey?' : 'Another send may duplicate the first',
      journey === 'investigate'
        ? '<p>The previous message remains uncertain. Restart from the resource step; a new message still requires its own click.</p><button id="confirm-send">Restart journey</button>'
        : '<p>The original request remains uncertain. A new send needs an explicit choice.</p><button id="confirm-send">Send another message</button>',
    );
    button('confirm-send').onclick = () => {
      closeDialog();
      void runLive();
    };
    return;
  }
  await runLive();
}
async function runLive() {
  if (busy || liveBlockReason()) return;
  busy = true;
  controls();
  if (journey === 'startup') {
    await syncEvidence();
    busy = false;
    controls();
    return;
  }
  let run = currentRun();
  if (journey !== 'investigate' || run?.status !== 'waiting') run = startRun();
  else {
    run.status = 'running';
    run.input = input();
  }
  const step = journey === 'investigate' ? (steps.get(run.id) ?? 0) : 0,
    operation = journey === 'investigate' ? actions[step]! : journey;
  log.activeRun = run.id;
  renderEvidence();
  schedulePoll();
  try {
    const response = await perform(operation, run);
    if (lifetime.signal.aborted || run.status === 'closed') return;
    run.result = boundedPayload(response.result);
    run.status = response.failed ? 'error' : operation === 'teardown' ? 'uncertain' : 'success';
    run.summary = response.summary;
    if (journey === 'investigate' && !response.failed && step < 3) {
      steps.set(run.id, step + 1);
      run.status = 'waiting';
      run.summary = `${response.summary} Next: ${journeys[actions[step + 1]!].title}.`;
    }
  } catch (error) {
    if (run.status !== 'closed' && !lifetime.signal.aborted) {
      const timeout = error instanceof McpError && error.code === Number(ErrorCode.RequestTimeout);
      run.status = timeout ? 'uncertain' : 'error';
      run.summary = timeout
        ? 'No acknowledgment arrived. Delivery is uncertain; no automatic retry.'
        : `Request failed: ${String(error)}`;
      run.result = boundedPayload({ error: String(error) });
      log.local('action.failed', { error: String(error) }, timeout ? 'uncertain' : 'error', run.id);
    }
  } finally {
    clearTimeout(poll);
    log.activeRun = undefined;
    if (connection === 'Connected') await syncEvidence();
    busy = false;
    controls();
    renderEvidence();
  }
}
app.onhostcontextchanged = (context) => {
  if (context.theme) applyDocumentTheme(context.theme);
};
app.ontoolinputpartial = () => {
  renderEvidence();
};
app.ontoolinput = () => {
  renderEvidence();
};
app.ontoolresult = () => {
  renderEvidence();
};
app.ontoolcancelled = (params) => {
  log.local('host.tool-cancelled', params, 'captured', 'startup');
};
app.onteardown = () => {
  let run = liveRuns.find((r) => r.id === log.teardownRun);
  if (!run) {
    run = {
      id: 'host-teardown',
      ordinal: ++ordinal,
      journey: 'teardown',
      mode: 'live',
      scenario: 'success',
      input: '',
      status: 'closed',
      summary: '',
      result: '{}',
      startedAt: new Date().toISOString(),
    };
    liveRuns.push(run);
    if (liveRuns.length > 30) {
      const evicted = liveRuns.shift()!;
      steps.delete(evicted.id);
      checked.delete(evicted.id);
    }
    selectedRuns.set('teardown', run.id);
  }
  run.status = 'closed';
  run.summary = 'Host cleanup request captured. The host controls actual removal.';
  log.local('app.cleanup', {}, 'captured', run.id);
  connection = 'Closed';
  clearTimeout(poll);
  lifetime.abort(new Error('Panel closed'));
  for (const other of liveRuns)
    if (other.status === 'running') {
      other.status = 'uncertain';
      other.summary = 'Panel closed while the action was pending. Outcome remains unknown.';
    }
  busy = false;
  controls();
  renderEvidence();
  return {};
};
app.onclose = () => {
  if (connection !== 'Closed') connection = 'Disconnected';
  clearTimeout(poll);
  lifetime.abort(new Error('Host disconnected'));
  for (const run of liveRuns)
    if (run.status === 'running') {
      run.status = 'uncertain';
      run.summary = 'Host disconnected during the request. Outcome remains unknown.';
    }
  busy = false;
  controls();
  renderEvidence();
};
app.onerror = (error) => log.local('app.error', String(error), 'error');
for (const [id, d] of Object.entries(journeys)) {
  const b = document.createElement('button');
  b.textContent =
    id === 'startup'
      ? 'Connect'
      : id === 'context'
        ? 'Provide context'
        : id === 'message'
          ? 'Send a message'
          : d.title;
  b.dataset.journey = id;
  b.onclick = () => {
    journey = id as JourneyId;
    scenario = 'success';
    focus = 'all';
    if (mode === 'fixture' && !fixtures.has(journey))
      fixtures.set(journey, makeFixture(journey, scenario, drafts.get(journey)));
    renderPage();
  };
  el('journeys', HTMLElement).append(b);
}
el('variants', HTMLDivElement).onclick = (event) => {
  if (!(event.target instanceof HTMLButtonElement) || busy) return;
  const value = event.target.dataset.variant;
  if (!variants().some(([id]) => id === value)) return;
  scenario = value as Scenario;
  if (mode === 'fixture') fixtures.set(journey, makeFixture(journey, scenario, input()));
  renderPage();
};
el('phase-focus', HTMLDivElement).onclick = (event) => {
  if (!(event.target instanceof HTMLButtonElement)) return;
  const value = event.target.dataset.phase;
  if (!['all', ...actions].includes(value ?? '')) return;
  focus = value as Phase;
  renderPage();
};
el('demo-text', HTMLInputElement).oninput = () => drafts.set(journey, input());
button('fixture-mode').onclick = () => {
  mode = 'fixture';
  scenario = 'success';
  if (!fixtures.has(journey))
    fixtures.set(journey, makeFixture(journey, scenario, drafts.get(journey)));
  renderPage();
};
button('live-mode').onclick = () => {
  mode = 'live';
  scenario = 'success';
  renderPage();
};
button('run').onclick = () => {
  void execute();
};
button('roles').onclick = explainRoles;
button('connection').onclick = connectionDetails;
button('capture').onclick = () => {
  const run = currentRun();
  if (!run || button('capture').disabled) return;
  capturePending = true;
  controls();
  const feedback = el('capture-status', HTMLParagraphElement);
  feedback.hidden = false;
  feedback.textContent = `Saving retained observations for run ${run.ordinal}…`;
  void (async () => {
    await publishReport();
    const result = await app.callServerTool(
      { name: 'diagnostics_capture', arguments: { interaction: run.id } },
      options,
    );
    if (result.isError)
      throw new Error(
        result.content?.find((item) => item.type === 'text')?.text ?? 'Capture rejected',
      );
    const saved = z
      .object({ path: z.string(), eventCount: z.number() })
      .parse(result.structuredContent);
    feedback.textContent = `Saved run ${run.ordinal}: ${saved.eventCount} retained observations to ${saved.path}`;
  })()
    .catch((error) => {
      feedback.textContent = `Capture not confirmed for run ${run.ordinal}: ${String(error)}. Check the log location before saving again.`;
    })
    .finally(() => {
      capturePending = false;
      controls();
    });
};
select('history').onchange = () => {
  selectedRuns.set(journey, select('history').value);
  const run = currentRun();
  if (run) scenario = run.scenario;
  focus = 'all';
  renderPage();
};
button('check-conversation').onclick = () => {
  const run = currentRun();
  if (!run) return;
  openDialog(
    'Check the main conversation',
    `<p>Look for this message and any assistant response. The app cannot verify arrival.</p><pre>${escape(run.input)}</pre><button id="checked">I checked the conversation</button>`,
  );
  button('checked').onclick = () => {
    checked.add(run.id);
    if (mode === 'live')
      log.local(
        'user.conversation-check',
        { userReported: true, deliveryUnverified: true },
        'captured',
        run.id,
      );
    closeDialog();
    controls();
  };
};
button('refresh').onclick = () => {
  if (busy) return;
  busy = true;
  controls();
  void syncEvidence().finally(() => {
    busy = false;
    controls();
  });
};
button('log-toggle').onclick = () => {
  const panel = el('event-log', HTMLElement);
  panel.hidden = !panel.hidden;
  button('log-toggle').setAttribute('aria-expanded', String(!panel.hidden));
  renderEvidence();
};
select('log-filter').onchange = renderEvidence;
button('export').onclick = () => {
  void (async () => {
    const body = JSON.stringify(
      {
        format: 'example-mcp-sequence/v3',
        panelId,
        build: EXAMPLE_BUILD,
        mode,
        runs: mode === 'fixture' ? [...fixtures.values()].map((f) => f.run) : liveRuns,
        events:
          mode === 'fixture' ? [...fixtures.values()].flatMap((f) => f.events) : observations.all(),
        evicted: { view: observations.dropped, app: log.dropped, server: serverDropped },
        scope:
          'Transport evidence only. Conversation arrival and model execution are not observed.',
      },
      null,
      2,
    );
    try {
      if (mode === 'live' && app.getHostCapabilities()?.downloadFile) {
        const response = await app.downloadFile(
          {
            contents: [
              {
                type: 'resource',
                resource: {
                  uri: 'example://export/trace.json',
                  mimeType: 'application/json',
                  text: body,
                },
              },
            ],
          },
          options,
        );
        exportStatus = response.isError
          ? 'Host declined export'
          : 'Host acknowledged export request; confirm file receipt';
      } else {
        const url = URL.createObjectURL(new Blob([body], { type: 'application/json' })),
          a = document.createElement('a');
        a.href = url;
        a.download = `example-mcp-${mode}-trace.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        exportStatus = 'Download requested; confirm file receipt';
      }
    } catch (error) {
      exportStatus = `Export failed: ${String(error)}`;
    }
    renderEvidence();
  })();
};
bindPreviews(() => currentRun()?.input ?? input());
window.addEventListener('resize', () => {
  document.body.classList.toggle('narrow', innerWidth < 700);
  renderEvidence();
});
document.body.classList.toggle('narrow', innerWidth < 700);
fixtures.set('startup', makeFixture('startup', 'success'));
renderPage();
async function connect() {
  if (!hostAvailable) return;
  busy = true;
  controls();
  const run = startRun('startup');
  log.local('app.mounted', { build: EXAMPLE_BUILD }, 'captured', 'startup');
  try {
    await app.connect(
      observedTransport(new PostMessageTransport(window.parent, window.parent), log),
      options,
    );
    if (lifetime.signal.aborted) return;
    connection = 'Connected';
    const context = app.getHostContext();
    if (context?.theme) applyDocumentTheme(context.theme);
    run.status = 'success';
    run.summary =
      'UI bridge connected. MCP startup is a separate connection; internal host ordering is not captured.';
    run.result = boundedPayload({
      host: app.getHostVersion(),
      capabilities: app.getHostCapabilities(),
    });
    await syncEvidence();
  } catch (error) {
    if (!lifetime.signal.aborted) {
      connection = 'Connection failed';
      run.status = 'error';
      run.summary = String(error);
      run.result = boundedPayload({ error: String(error) });
    }
  }
  busy = false;
  controls();
  renderEvidence();
}
void connect();
