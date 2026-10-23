import { poll } from '../../../mcp-app-runtime/src/poller.ts';
import { HostSession } from '../../../mcp-app-runtime/src/host-session.ts';
import { RuntimeError, failureCode } from '../../../mcp-app-runtime/src/definition.ts';
import { z } from 'zod';
import {
  backgroundActions,
  parseReportOutput,
  type ReportOutput,
  bindingSchema,
  payloadSchema,
  textSchema,
  overviewSchema,
  statusSchema,
  recordsSchema,
  timezoneSchema,
  documentSchema,
  type Binding,
  type Request,
} from './contracts.ts';
import { BUILD, VERSION } from '../repo-canvas/src/model/build.ts';
import { mountUsage } from '../usage/browser/main.ts';
import { mount, unmount } from '../session-review/src/mount.tsx';
import { resetReviewNavigation, reviewSelection } from '../session-review/src/app/state.ts';
import type { ReviewDocument } from '../session-review/src/model/contracts.ts';
import type { RecordSource } from '../session-review/src/model/data-source.ts';
import { AppDiagnostics, plainMessageFlow } from '../diagnostics/client.ts';

const app = new HostSession(
  { name: 'Repo Workbench reports', version: VERSION },
  {
    onhostcontextchanged: (context) => theme(context.theme),
    onteardown: () => {
      close();
      return {};
    },
    onclose: close,
    onerror: (error) => message(String(error)),
    ontoolresult: (result) => receiveToolResult(result),
  },
);
const inspection = new AppDiagnostics({
  remote: readReportDiagnostics,
  name: 'Workbench reports',
  version: VERSION,
  build: BUILD,
  mode: 'hosted',
  info: () => ({
    binding,
    connection: closed ? 'closed' : binding ? 'connected' : 'waiting',
    capabilities: app.getHostCapabilities(),
    responseFormat:
      'Report results are inspected after gzip decoding; transport compression is not shown as domain data.',
  }),
  flows: [
    plainMessageFlow,
    {
      name: 'Selected report context · fixture',
      steps: [
        'App freezes the selected turn/action or visible usage scope',
        'App → Host → Server: select_usage or select_trace',
        'Server → App: bounded selected summary',
        'App → Host: text and frozen summary',
        'Host → App: acknowledgment; conversation arrival remains separate',
      ],
      request: {
        text: 'Explain this selection',
        context: 'Only the selected summary and its scoped read handles',
      },
      reads: ['report_app select_usage OR select_trace only when Attach is checked'],
    },
  ],
});
async function readReportDiagnostics(name: string, args: Record<string, unknown>) {
  const result = await app.callServerTool({ name, arguments: args }, { timeout: 5000 });
  if (result.isError)
    throw new Error(
      result.content?.find((item) => item.type === 'text')?.text ?? 'Diagnostics unavailable',
    );
  return result.structuredContent;
}
document.getElementById('report-toolbar')!.append(inspection.button());
const inspectSend = document.createElement('button');
inspectSend.textContent = 'Inspect send';
inspectSend.hidden = true;
inspectSend.onclick = () => inspection.show('Interactions', lastSend);
document.getElementById('report-toolbar')!.append(inspectSend);
let lastSend: string | undefined;
const status = document.getElementById('report-status')!;
status.title = `Repo Workbench ${VERSION} · build ${BUILD}`;
const question = document.querySelector<HTMLInputElement>('#report-question')!;
const send = document.querySelector<HTMLButtonElement>('#report-send')!;
const attach = document.querySelector<HTMLInputElement>('#report-context')!;
const back = document.querySelector<HTMLButtonElement>('#report-back')!;
const usageView = document.getElementById('usage-view')!;
const traceView = document.getElementById('root')!;
const usageTemplate = usageView.innerHTML;
let binding: Binding | undefined;
let usage: ReturnType<typeof mountUsage> | undefined;
let session: string | undefined;
let traceDocument: ReviewDocument | undefined;
let generation = 0;
let closed = false;
let sending = false;
let composerRevision = 0;
let stopPolling: (() => void) | undefined;
let refreshPromise: Promise<z.infer<typeof overviewSchema>> | undefined;
let cachedAt = '';
const lifetime = { signal: app.signal };
let statusOwner: 'connection' | 'discussion' = 'connection';
function message(text: string, owner: typeof statusOwner = 'connection') {
  if (!closed) {
    statusOwner = owner;
    status.textContent = text;
  }
}
function controls() {
  send.disabled =
    closed || sending || !binding || !question.value.trim() || !app.getHostCapabilities()?.message;
}
function theme(value?: string) {
  if (value === 'light' || value === 'dark') document.documentElement.dataset.theme = value;
}
function close() {
  closed = true;
  generation++;
  stopPolling?.();
  void app.dispose();
  usage?.dispose();
  unmount();
  controls();
  back.disabled = true;
  usageView.inert = true;
  traceView.inert = true;
  status.textContent = 'Connection closed. Reopen the report to reconnect.';
}
async function call<R extends Request>(
  request: R,
  interaction?: string,
): Promise<ReportOutput<R['action']>> {
  const trace = { interaction: interaction ?? crypto.randomUUID(), callId: crypto.randomUUID() };
  return inspection.observe(
    `report_app:${request.action} · decoded`,
    {
      contextId: binding?.contextId,
      expectedRevision: binding?.revision,
      request,
      _meta: { 'repo-kit/interaction': trace },
    },
    async () => parseReportOutput<R['action']>(request.action, await perform(request, trace)),
    {
      ...trace,
      retention: interaction || !backgroundActions.includes(request.action) ? 'user' : 'background',
    },
  );
}
async function perform(
  request: Request,
  trace: { interaction: string; callId: string },
): Promise<unknown> {
  if (!binding || closed) throw new Error('Report is not connected. Reopen it.');
  const current = binding;
  const result = await app.callServerTool(
    {
      name: 'report_app',
      _meta: { 'repo-kit/interaction': trace },
      arguments: { contextId: current.contextId, expectedRevision: current.revision, request },
    },
    { timeout: 180000, signal: lifetime.signal },
  );
  if (result.isError)
    throw new RuntimeError(
      failureCode(result._meta?.['repo-kit/error']) ?? 'rejected',
      result.content?.find((c) => c.type === 'text')?.text ?? 'Report operation failed',
    );
  const meta = payloadSchema.parse(result._meta);
  if (meta.build !== BUILD)
    app.incompatible('Server/UI build mismatch. Reconnect and reopen the app.');
  const bytes = Uint8Array.from(atob(meta.payload), (c) => c.charCodeAt(0));
  const value: unknown = JSON.parse(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),
    ).text(),
  );
  if (closed || binding.contextId !== current.contextId || binding.revision !== current.revision)
    throw new Error('Report context changed.');
  return value;
}
const scrollPositions = { usage: 0, trace: 0 };
let shown: 'usage' | 'trace' = 'usage';
function view(kind: 'usage' | 'trace') {
  scrollPositions[shown] = window.scrollY;
  shown = kind;
  usageView.hidden = kind !== 'usage';
  traceView.hidden = kind !== 'trace';
  back.hidden = kind !== 'trace' || !usage;
  (document.querySelector('#usage-style') as HTMLStyleElement).media =
    kind === 'usage' ? 'all' : 'not all';
  (document.querySelector('#trace-style') as HTMLStyleElement).media =
    kind === 'trace' ? 'all' : 'not all';
  document.documentElement.dataset.report = kind;
  requestAnimationFrame(() => {
    if (!closed) window.scrollTo(0, scrollPositions[kind]);
  });
  const label = document.getElementById('report-context-label');
  if (label)
    label.textContent =
      kind === 'trace' ? 'Attach selected turn/action' : 'Attach filters or open evidence';
}
function showTrace(data: ReviewDocument, id: string) {
  session = id;
  traceDocument = data;
  resetReviewNavigation();
  const currentBinding = binding?.contextId;
  const source: RecordSource = {
    manifest:
      'data:application/json;charset=utf-8,' +
      encodeURIComponent(
        JSON.stringify({
          collectedAt: data.collectedAt,
          sources: data.threads.map((t) => ({ id: t.id, source: t.source, coverage: t.coverage })),
        }),
      ),
    async text(event, field, offset, signal) {
      signal.throwIfAborted();
      if (binding?.contextId !== currentBinding) throw new Error('Report context changed.');
      if (!event.body) {
        const value = event[field] ?? '';
        return { text: value, offset: 0, nextOffset: value.length, total: value.length };
      }
      const result = textSchema.parse(
        await call({
          action: 'text',
          session: id,
          event: event.key,
          revision: event.body.sources.map((s) => s.sha256).join('.'),
          field,
          offset,
        }),
      );
      signal.throwIfAborted();
      return result;
    },
    image(event, index) {
      return event.imageUrls?.[index];
    },
    async loadImage(event, index) {
      const result = z
        .object({ image: z.string().regex(/^data:image\/(png|jpeg|webp|gif);base64,/) })
        .parse(
          await call({
            action: 'image',
            session: id,
            event: event.key,
            revision: event.body?.sources.map((s) => s.sha256).join('.') ?? '',
            index,
          }),
        );
      return result.image;
    },
  };
  view('trace');
  mount({ ...data, delivery: undefined }, source);
  message(`Trace · ${id}`);
}
async function openTrace(id: string) {
  const current = ++generation;
  message('Opening trace…');
  try {
    const value = z
      .object({ document: documentSchema })
      .parse(await call({ action: 'trace', session: id }));
    if (current === generation && !closed) showTrace(value.document, id);
  } catch (error) {
    if (current === generation) message(String(error));
  }
}
const currentTimezone = () =>
  timezoneSchema.parse((document.querySelector('#timezone') as HTMLSelectElement).value);
function refreshMessage(text: string, error = false) {
  // Background completion must not erase an explicit send's outcome or retry information.
  if (!sending && statusOwner !== 'discussion') message(text);
  else if (error) {
    const feedback = document.querySelector<HTMLElement>('#message');
    if (feedback) {
      feedback.textContent = text;
      feedback.className = 'error';
    }
  }
}
function refreshOverview() {
  if (refreshPromise) return refreshPromise;
  const contextId = binding?.contextId;
  const pending = (async () => {
    const updated = z
      .object({ binding: bindingSchema, snapshot: overviewSchema })
      .parse(await call({ action: 'refresh', timezone: currentTimezone() }));
    if (closed || binding?.contextId !== contextId) throw new Error('Report context changed.');
    binding = updated.binding;
    if (!session) refreshMessage('Connected · Recorded usage, not billing');
    return updated.snapshot;
  })().finally(() => {
    if (refreshPromise === pending) refreshPromise = undefined;
  });
  refreshPromise = pending;
  return pending;
}
function watchRefresh(contextId: string) {
  stopPolling?.();
  stopPolling = poll(
    async (signal) => {
      if (closed || binding?.contextId !== contextId) {
        stopPolling?.();
        return;
      }
      const state = statusSchema.parse(await call({ action: 'status' }));
      if (signal.aborted || closed || binding?.contextId !== contextId) return;
      if (state.error) {
        refreshMessage(`Refresh failed: ${state.error} Use Refresh logs to retry.`, true);
        stopPolling?.();
        return;
      }
      if (state.updated && !session && !sending) {
        const data = await refreshOverview();
        if (!signal.aborted && !closed && binding?.contextId === contextId) usage?.update(data);
      }
      if (!state.refreshing && !state.updated) stopPolling?.();
    },
    { interval: 1000, immediate: false },
  );
}
function receiveToolResult(result: import('@modelcontextprotocol/sdk/types.js').CallToolResult) {
  if (closed) return;
  if (result.isError) {
    message(result.content?.find((c) => c.type === 'text')?.text ?? 'Could not open the report.');
    return;
  }
  const parsed = bindingSchema.safeParse(result.structuredContent);
  if (!parsed.success) return;
  const current = ++generation;
  stopPolling?.();
  refreshPromise = undefined;
  binding = parsed.data;
  message('Loading recorded history…');
  usage?.dispose();
  usage = undefined;
  unmount();
  session = undefined;
  usageView.innerHTML = usageTemplate;
  controls();
  void (async () => {
    const started = performance.now();
    if (binding?.build !== BUILD)
      app.incompatible('Server/UI build mismatch. Reconnect and reopen.');
    const value = z
      .object({
        binding: bindingSchema,
        snapshot: overviewSchema,
        refreshing: z.boolean(),
        timings: z.record(z.string(), z.number()).optional(),
        document: documentSchema.optional(),
      })
      .parse(await call({ action: 'snapshot', timezone: currentTimezone() }));
    if (current !== generation || closed) return;
    if (value.binding.kind === 'trace') {
      if (!value.document || !value.binding.session)
        throw new Error('Trace data unavailable. Reopen it.');
      showTrace(value.document, value.binding.session);
    } else {
      usage = mountUsage(value.snapshot, {
        openTrace: (id) => {
          void openTrace(id);
        },
        refresh: refreshOverview,
        async timezone(timezone) {
          const value = z
            .object({ snapshot: overviewSchema })
            .parse(await call({ action: 'snapshot', timezone: timezoneSchema.parse(timezone) }));
          return value.snapshot;
        },
        async evidence(rows, timezone) {
          return z.object({ records: recordsSchema }).parse(
            await call({
              action: 'evidence',
              ids: rows.map((row) => row.id),
              timezone: timezoneSchema.parse(timezone),
            }),
          ).records;
        },
        async export(filters) {
          return z
            .object({ records: recordsSchema })
            .parse(await call({ action: 'export', filters })).records;
        },
      });
      view('usage');
      cachedAt = new Date(value.snapshot.generatedAt).toLocaleString();
      message(
        value.refreshing
          ? `Cached summary · ${cachedAt} · Refreshing history…`
          : 'Connected · Recorded usage, not billing',
      );
      status.title = `Repo Workbench ${VERSION} · build ${BUILD}\nPanel load: ${Math.round(performance.now() - started)} ms\n${JSON.stringify(value.timings ?? {})}`;
      if (value.refreshing) watchRefresh(binding.contextId);
    }
    controls();
  })().catch((error) => {
    if (current === generation) message(String(error));
  });
}
back.onclick = () => {
  generation++;
  unmount();
  session = undefined;
  view('usage');
  message('Connected · Recorded usage, not billing');
  back.hidden = true;
};
question.oninput = () => {
  composerRevision++;
  controls();
};
attach.onchange = () => {
  composerRevision++;
};
send.onclick = () => {
  if (send.disabled) return;
  sending = true;
  controls();
  const text = question.value;
  const selectionIdentity = () =>
    !attach.checked
      ? ''
      : session
        ? `trace:${session}:${reviewSelection()}`
        : `usage:${JSON.stringify(usage?.selection())}`;
  const sentSelection = selectionIdentity();
  const sentRevision = composerRevision;
  const interaction = crypto.randomUUID();
  const contextId = binding?.contextId;
  void (async () => {
    let context: unknown;
    if (attach.checked) {
      if (session && traceDocument) {
        const selected = new URLSearchParams(reviewSelection().replace(/^#/, ''));
        const event = selected.get('event');
        const exact =
          event &&
          traceDocument.threads
            .flatMap((t) => t.turns.flatMap((turn) => turn.events))
            .find((e) => e.key === event);
        const actionTurn: unknown = selected.get('actionTurn')
          ? JSON.parse(selected.get('actionTurn')!)
          : undefined;
        const pair = z.tuple([z.string(), z.string()]).safeParse(actionTurn);
        const thread = exact
          ? exact.threadId
          : pair.success
            ? pair.data[0]
            : selected.get('thread') ||
              traceDocument.threads.find((t) => t.purpose !== 'auto-review')?.id;
        const turn = exact ? exact.turnId : pair.success ? pair.data[1] : selected.get('turn');
        if (!thread || !turn)
          throw new Error('Choose a turn or action to attach, or turn off Attach selection.');
        context = await call(
          {
            action: 'select_trace',
            session,
            scope: {
              thread,
              turn,
              ...(event ? { event } : {}),
              reviews: selected.get('reviews') === 'show',
            },
          },
          interaction,
        );
      } else {
        const selection = usage?.selection();
        if (!selection) throw new Error('Wait for usage to load, or turn off Attach selection.');
        context = await call({ action: 'select_usage', ...selection }, interaction);
      }
    }
    const textToSend =
      context === undefined
        ? text
        : text + '\n\nSelected report context (frozen data):\n' + JSON.stringify(context);
    if (textToSend.length > 20000)
      throw new Error('Selection summary is too large. Narrow the selection.');
    message('Sending to this chat…', 'discussion');
    try {
      const payload = {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: textToSend,
          },
        ],
      };
      const pending = inspection.observe(
        'ui/message',
        payload,
        () => app.sendMessage(payload, { timeout: 10000, signal: lifetime.signal }),
        { interaction, retention: 'user' },
      );
      lastSend = inspection.lastInteraction;
      inspectSend.hidden = false;
      const result = await pending;
      if (result.isError) {
        message('Host rejected the message. Your draft is preserved.', 'discussion');
        return;
      }
      if (closed || binding?.contextId !== contextId) return;
      if (composerRevision === sentRevision && selectionIdentity() === sentSelection) {
        question.value = '';
        attach.checked = false;
      }
      message('Accepted by host · Check this chat for arrival and a response.', 'discussion');
    } catch (error) {
      message(
        error instanceof RuntimeError && error.code === 'rejected'
          ? `Host rejected the message. Your draft is preserved. ${String(error)}`
          : `Delivery unconfirmed. Check the chat before sending again. ${String(error)}`,
        'discussion',
      );
    }
  })()
    .catch((error) => message(String(error), 'discussion'))
    .finally(() => {
      sending = false;
      controls();
    });
};
document.addEventListener('click', (event) => {
  const link = event.target instanceof Element ? event.target.closest('a') : null;
  if (!link || !/^(https?:|codex:)/.test(link.getAttribute('href') ?? '')) return;
  event.preventDefault();
  if (!app.getHostCapabilities()?.openLinks) {
    message(`Open this link outside the panel: ${link.href}`);
    return;
  }
  void app.openLink({ url: link.href }).catch((error) => message(String(error)));
});
void app
  .connect(undefined, { timeout: 10000 })
  .then(() => {
    theme(app.getHostContext()?.theme);
    controls();
    if (!app.getHostCapabilities()?.serverTools)
      message('This host cannot load report data. Use the standalone CLI.');
  })
  .catch((error) => {
    controls();
    message(`Connection failed: ${String(error)}. Reopen the app to retry.`);
  });
