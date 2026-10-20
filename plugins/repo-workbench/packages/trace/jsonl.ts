import { readQuestions, questionResult, linkCompactions } from './native-tools.ts';
import { toolSignature, toolSignatures, wrapperTools } from './tool-signatures.ts';
import { semanticOperation, linkSemanticActions } from './semantic-links.ts';
import { TurnTelemetry } from './telemetry.ts';
import {
  commandHashes,
  nativeCommandHash,
  executionCommand,
  linkExecutions,
  type ExecutionLink,
} from './link-executions.ts';
import { classifyRequest } from './classify.ts';
import { completedEvent } from './completed.ts';
import { open } from 'node:fs/promises';
import type { ReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import type { TraceEvent, TraceThread, Omission, ReviewDocument } from './contracts.ts';
import { eventKey } from './normalize.ts';
type Obj = Record<string, unknown>;
const object = (value: unknown): Obj =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : {};
const string = (value: unknown) => (typeof value === 'string' ? value : '');
const clean = (text: string) =>
  text
    .replace(/<in-app-browser-context\b[\s\S]*?<\/in-app-browser-context>/g, '')
    .replace(/^\s*## My request:\s*/m, '')
    .trim();
function content(value: unknown): { text: string; images: string[] } {
  if (typeof value === 'string') return { text: clean(value), images: [] };
  const text: string[] = [],
    images: string[] = [];
  for (const block of Array.isArray(value) ? value : []) {
    const item = object(block);
    if (['input_text', 'output_text', 'text', 'Text'].includes(string(item.type)))
      text.push(clean(string(item.text)));
    if (item.type === 'input_image' || item.type === 'image') {
      const url =
        string(item.image_url) ||
        string(object(item.image_url).url) ||
        (item.type === 'image' && string(item.data)
          ? `data:${string(item.mimeType)};base64,${string(item.data)}`
          : '');
      if (/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(url)) images.push(url);
      else text.push('(Image bytes unavailable locally; remote images are not fetched.)');
    }
  }
  return { text: text.join('\n'), images };
}
const bodyPreviewSize = 1200;
/** Keep byte offsets exact for UTF-8, CRLF, blank lines and unterminated tails. */
async function* sourceLines(stream: ReadStream) {
  let parts: Buffer[] = [],
    size = 0,
    offset = 0;
  for await (const chunk of stream) {
    const bytes = chunk as Buffer;
    let start = 0;
    for (let end = bytes.indexOf(10); end !== -1; end = bytes.indexOf(10, start)) {
      const part = bytes.subarray(start, end + 1);
      const record = parts.length ? Buffer.concat([...parts, part], size + part.length) : part;
      yield {
        raw: record.toString('utf8').replace(/\r?\n$/, ''),
        offset,
        bytes: record.length,
        sha256: createHash('sha256').update(record).digest('hex'),
      };
      offset += record.length;
      parts = [];
      size = 0;
      start = end + 1;
    }
    if (start < bytes.length) {
      const part = bytes.subarray(start);
      parts.push(part);
      size += part.length;
    }
  }
  if (size) {
    const record = Buffer.concat(parts, size);
    yield {
      raw: record.toString('utf8'),
      offset,
      bytes: size,
      sha256: createHash('sha256').update(record).digest('hex'),
    };
  }
}
export type RecordBody = { text: string; output?: string; imageUrls: string[] };
function observableBody(data: Obj): RecordBody | null {
  const p = object(data.payload),
    type = string(data.type),
    kind = string(p.type);
  if (type === 'event_msg' && kind === 'item_completed') {
    const event = completedEvent(p, 'Session');
    const message = ['UserMessage', 'AgentMessage'].includes(string(object(p.item).type));
    const value = message ? content(object(p.item).content) : null;
    return event
      ? {
          text: value?.text ?? event.text,
          ...(event.output !== undefined ? { output: event.output } : {}),
          imageUrls: value?.images ?? [],
        }
      : null;
  }
  if (type === 'response_item' && kind === 'agent_message')
    return { text: content(p.content).text, imageUrls: content(p.content).images };
  if (type === 'event_msg' && kind === 'thread_goal_updated')
    return { text: string(object(p.goal).objective), imageUrls: [] };
  if (type === 'response_item' && kind === 'message' && p.channel !== 'analysis') {
    const value = content(p.content);
    if (p.encrypted_content && !value.text && !value.images.length) return null;
    return { text: value.text, imageUrls: value.images };
  }
  if (
    type === 'response_item' &&
    ['function_call', 'custom_tool_call', 'web_search_call'].includes(kind)
  )
    return {
      text: string(p.arguments) || string(p.input) || JSON.stringify(p.action ?? {}),
      imageUrls: [],
    };
  if (
    type === 'response_item' &&
    ['function_call_output', 'custom_tool_call_output'].includes(kind)
  ) {
    if (p.encrypted_content && p.output === undefined) return null;
    const value = content(p.output);
    return {
      text: 'Recorded tool result',
      output: value.text || (Array.isArray(p.output) ? '' : JSON.stringify(p.output ?? '')),
      imageUrls: value.images,
    };
  }
  if (type === 'event_msg' && ['user_message', 'agent_message'].includes(kind))
    return { text: clean(string(p.message)), imageUrls: content(p.content).images };
  return null;
}
/** Read only the pinned observable record, never a request-supplied file path. */
export async function readSessionBody(thread: TraceThread, event: TraceEvent): Promise<RecordBody> {
  if (!event.body || !thread.source.path) throw new Error('Record body is not indexed.');
  const handle = await open(thread.source.path, 'r');
  try {
    let result: RecordBody | null = null;
    for (const source of event.body.sources) {
      const buffer = Buffer.alloc(source.bytes);
      let read = 0;
      while (read < buffer.length) {
        const next = await handle.read(buffer, read, buffer.length - read, source.offset + read);
        if (!next.bytesRead) break;
        read += next.bytesRead;
      }
      if (
        read !== buffer.length ||
        createHash('sha256').update(buffer).digest('hex') !== source.sha256
      )
        throw new Error('Source record changed. Reopen the trace to refresh it.');
      const body = observableBody(object(JSON.parse(buffer.toString('utf8'))));
      if (!body) throw new Error('This payload is unavailable.');
      if (!result) result = body;
      else result.imageUrls = [...new Set([...result.imageUrls, ...body.imageUrls])];
    }
    if (!result) throw new Error('Record body is unavailable.');
    return result;
  } finally {
    await handle.close();
  }
}

/** Stream one bounded local source into the existing observable-event contract. */
export async function normalizeSessionFile(
  path: string,
  expectedSession: string,
  role = 'Session',
  options: { lazyBodies?: boolean } = {},
): Promise<TraceThread> {
  const handle = await open(path, 'r');
  const before = await handle.stat();
  const hash = createHash('sha256');
  const thread: TraceThread = {
    id: expectedSession,
    title: expectedSession,
    role,
    source: {
      name: 'CodexJsonlAdapter',
      format: 'codex_jsonl',
      version: 1,
      rawSchemaVersion: 0,
      path,
      bytes: before.size,
    },
    coverage: {
      totalItems: 0,
      normalizedItems: 0,
      unsupportedItems: [],
      excludedItems: [],
      truncatedItems: 0,
      displayTruncatedItems: 0,
    },
    turns: [],
  };
  let identityVerified = false;
  let cwd: string | undefined;
  let reviewModelSeen = false,
    ordinaryModelSeen = false;
  let turnId = 'session-prefix',
    line = 0;
  const turns = new Map<string, TraceThread['turns'][number]>();
  const toolNames = new Map<string, string>();
  const executionLinks: ExecutionLink[] = [];
  const operations = new Map<string, ReturnType<typeof semanticOperation>>();
  const telemetry = new TurnTelemetry();
  const canonicalMessages = new Set<string>();
  const canonicalEvents = new Map<string, { event: TraceEvent; imageHashes: Set<string> }>();
  const nativeMessages: Array<{ event: TraceEvent; signature: string; images: string[] }> = [];
  const messages = new Map<string, { from: string; event: TraceEvent; imageHashes: Set<string> }>();
  const omission = (items: Omission[], type: string, id: string) => {
    let group = items.find((item) => item.type === type);
    if (!group) items.push((group = { type, count: 0, refs: [] }));
    group.count++;
    group.refs.push({ thread: expectedSession, turn: turnId, event: id, ordinal: line });
  };
  const stream = before.size
    ? handle.createReadStream({ start: 0, end: before.size - 1, autoClose: false })
    : null;
  try {
    if (stream) {
      stream.on('data', (bytes: string | Buffer) => hash.update(bytes));
      for await (const record of sourceLines(stream)) {
        const { raw } = record;
        line++;
        if (!raw.trim()) continue;
        thread.coverage.totalItems++;
        const id = `line:${line}`;
        let data: Obj;
        try {
          data = object(JSON.parse(raw));
        } catch {
          omission(thread.coverage.unsupportedItems, 'malformed_json_or_incomplete_tail', id);
          continue;
        }
        const p = object(data.payload),
          type = string(data.type),
          payloadType = string(p.type);
        const timestamp = string(data.timestamp);
        telemetry.observe(type, p, timestamp);
        if (type === 'session_meta') {
          identityVerified = true;
          cwd = string(p.cwd) || undefined;
          const recordedId = string(p.id) || string(p.thread_id);
          if (recordedId !== expectedSession)
            throw new Error('Session source identity changed; refresh the usage dashboard.');
          const source = object(p.source);
          if (
            /guardian_review|approval_review|auto.?review/.test(string(source.subagent)) ||
            Object.keys(object(source.subagent)).some((kind) =>
              /^(guardian_review|approval_review|auto.?review)$/.test(kind),
            )
          )
            thread.purpose = 'auto-review';
          const spawn = object(object(source.subagent).thread_spawn);
          thread.parent =
            string(p.parent_thread_id) ||
            string(p.forked_from_id) ||
            string(spawn.parent_thread_id) ||
            undefined;
        }
        if (type === 'turn_context' && string(p.model)) {
          if (p.model === 'codex-auto-review') reviewModelSeen = true;
          else ordinaryModelSeen = true;
        }
        if (type === 'turn_context' && string(p.turn_id)) turnId = string(p.turn_id);
        if (type === 'event_msg' && payloadType === 'task_started' && string(p.turn_id))
          turnId = string(p.turn_id);
        if (type === 'event_msg' && payloadType === 'item_completed' && string(p.turn_id))
          turnId = string(p.turn_id);
        if (
          type === 'response_item' &&
          string(object(p.internal_chat_message_metadata_passthrough).turn_id)
        )
          turnId = string(object(p.internal_chat_message_metadata_passthrough).turn_id);
        const textContent =
          type === 'response_item' && payloadType === 'message'
            ? content(p.content)
            : { text: '', images: [] };
        let event: (Pick<TraceEvent, 'kind' | 'title' | 'text'> & Partial<TraceEvent>) | undefined;
        let excluded = false;
        if (
          type === 'response_item' &&
          (payloadType === 'reasoning' || (payloadType === 'message' && p.channel === 'analysis'))
        )
          excluded = true;
        else if (
          type === 'compacted' ||
          (type === 'response_item' && payloadType === 'compaction')
        ) {
          event = {
            kind: 'compaction',
            title: type === 'compacted' ? 'Context compacted' : 'Compacted context loaded',
            text:
              type === 'compacted'
                ? 'Context was compacted. Conversation history was condensed for continued work.'
                : 'A previously compacted context was loaded into this session. Its private payload is excluded.',
            compaction: {
              window: typeof p.window_number === 'number' ? p.window_number : undefined,
            },
          };
        } else if (type === 'event_msg' && payloadType === 'item_completed') {
          const itemType = string(object(p.item).type);
          if (
            itemType === 'Reasoning' ||
            (itemType === 'AgentMessage' && object(p.item).phase === 'analysis')
          )
            excluded = true;
          else event = completedEvent(p, role);
        } else if (type === 'response_item' && payloadType === 'agent_message') {
          event = {
            kind: 'message',
            title: 'Agent-to-agent message',
            text: content(p.content).text,
            imageUrls: content(p.content).images,
            role: 'Agent message',
          };
        } else if (type === 'event_msg' && payloadType === 'thread_goal_updated') {
          event = {
            kind: 'goal',
            title: 'Goal update',
            text: string(object(p.goal).objective),
            role: 'Codex runtime',
            status: string(object(p.goal).status),
          };
        } else if (type === 'response_item' && payloadType === 'message') {
          if (p.encrypted_content && !textContent.text && !textContent.images.length) {
            omission(thread.coverage.unsupportedItems, 'encrypted_message_unavailable', id);
            continue;
          }
          const user = p.role === 'user';
          event = {
            kind: user ? 'request' : 'message',
            title: user
              ? 'User request'
              : p.role === 'assistant'
                ? 'Assistant message'
                : 'Recorded message',
            role: user ? 'User' : role,
            text: textContent.text,
            imageUrls: textContent.images,
            messagePhase:
              p.role === 'assistant'
                ? p.phase === 'final_answer' || p.channel === 'final'
                  ? 'final_answer'
                  : p.phase === 'commentary' || p.channel === 'commentary'
                    ? 'commentary'
                    : undefined
                : undefined,
          };
        } else if (
          type === 'response_item' &&
          ['function_call', 'custom_tool_call', 'web_search_call'].includes(payloadType)
        ) {
          const name = string(p.name) || payloadType;
          const callId = string(p.call_id);
          if (callId) toolNames.set(callId, name);
          const args = string(p.arguments) || string(p.input) || JSON.stringify(p.action ?? {});
          event = {
            kind: /apply_patch/.test(name)
              ? 'edit'
              : /spawn_agent|send_message|followup_task|delegate/.test(name)
                ? 'delegation'
                : payloadType === 'web_search_call'
                  ? 'reference'
                  : /view_image/.test(name)
                    ? 'image'
                    : 'command',
            title: name,
            text: args,
            callId,
          };
          if (/(?:^|[._])request_user_input(?:_async)?$/.test(name)) {
            event.kind = 'ask';
            try {
              event.questions = readQuestions(object(JSON.parse(args)).questions);
            } catch {
              /* Keep original arguments. */
            }
          }
          if (event.kind === 'delegation') {
            try {
              const argsObject = object(JSON.parse(args));
              event.relatedThreads = [
                string(argsObject.target),
                string(argsObject.thread_id),
              ].filter(Boolean);
            } catch {
              /* Keep recorded arguments intact. */
            }
          }
        } else if (
          type === 'response_item' &&
          ['function_call_output', 'custom_tool_call_output'].includes(payloadType)
        ) {
          if (p.encrypted_content && p.output === undefined) {
            omission(thread.coverage.unsupportedItems, 'encrypted_tool_result_unavailable', id);
            continue;
          }
          const output = content(p.output);
          event = {
            kind: 'command',
            title: 'Tool result · ' + (toolNames.get(string(p.call_id)) ?? 'unknown tool'),
            text: 'Recorded tool result',
            output: output.text || (Array.isArray(p.output) ? '' : JSON.stringify(p.output ?? '')),
            callId: string(p.call_id),
            imageUrls: output.images,
            ...(/request_user_input(?:_async)?$/.test(toolNames.get(string(p.call_id)) ?? '')
              ? { questionResult: questionResult(p.output) }
              : {}),
          };
        } else if (
          type === 'event_msg' &&
          ['user_message', 'agent_message'].includes(payloadType)
        ) {
          event = {
            kind: payloadType === 'user_message' ? 'request' : 'message',
            title: payloadType === 'user_message' ? 'User request' : 'Assistant message',
            text: clean(string(p.message)),
            role: payloadType === 'user_message' ? 'User' : role,
            imageUrls: content(p.content).images,
          };
        } else if (type === 'event_msg' && ['agent_reasoning', 'reasoning'].includes(payloadType))
          excluded = true;
        else if (
          [
            'session_meta',
            'turn_context',
            'token_usage_record',
            'compacted',
            'world_state',
            'inter_agent_communication_metadata',
          ].includes(type) ||
          (type === 'event_msg' &&
            [
              'token_count',
              'task_started',
              'task_complete',
              'task_completed',
              'thread_settings_applied',
            ].includes(payloadType))
        )
          excluded = true;
        if (!event) {
          omission(
            excluded ? thread.coverage.excludedItems : thread.coverage.unsupportedItems,
            `${type}/${payloadType || 'metadata'}${payloadType === 'item_completed' ? '/' + string(object(p.item).type) : ''}`,
            id,
          );
          continue;
        }
        const nativeMessage =
          type === 'event_msg' &&
          payloadType === 'item_completed' &&
          ['UserMessage', 'AgentMessage'].includes(string(object(p.item).type));
        if (nativeMessage) {
          const value = content(object(p.item).content);
          event.text = value.text;
          event.imageUrls = value.images;
        }
        if (!nativeMessage && (event.kind === 'request' || event.kind === 'message'))
          canonicalMessages.add(
            JSON.stringify([
              turnId,
              event.kind,
              createHash('sha256').update(event.text).digest('hex'),
            ]),
          );
        // Some generations emit both an event message and its response-item copy.
        // Only deduplicate matching text from different envelopes in this turn.
        if (event.kind === 'request' || event.kind === 'message') {
          const signature = JSON.stringify([
            turnId,
            event.kind,
            createHash('sha256').update(event.text).digest('hex'),
          ]);
          const prior = messages.get(signature);
          if (!nativeMessage && prior && prior.from !== type && event.text) {
            prior.event.messagePhase ??= event.messagePhase;
            if (options.lazyBodies && event.imageUrls?.length && prior.event.body) {
              prior.event.body.sources.push({
                offset: record.offset,
                bytes: record.bytes,
                sha256: record.sha256,
              });
              for (const url of event.imageUrls)
                prior.imageHashes.add(createHash('sha256').update(url).digest('hex'));
              prior.event.body.imageCount = prior.imageHashes.size;
            }
            prior.event.imageUrls = options.lazyBodies
              ? []
              : [...new Set([...(prior.event.imageUrls ?? []), ...(event.imageUrls ?? [])])];
            omission(thread.coverage.excludedItems, 'duplicate_message_envelope', id);
            messages.delete(signature);
            continue;
          }
        }
        let turn = turns.get(turnId);
        if (!turn) {
          turn = { id: turnId, threadId: expectedSession, events: [] };
          if (Number.isFinite(Date.parse(timestamp))) turn.startedAt = Date.parse(timestamp) / 1000;
          turns.set(turnId, turn);
          thread.turns.push(turn);
        }
        const base = { threadId: expectedSession, turnId, id, ordinal: line };
        const normalized: TraceEvent = {
          ...base,
          role,
          status: '',
          paths: [],
          relatedThreads: [],
          sourceType: `${type}/${payloadType}${payloadType === 'item_completed' ? '/' + string(object(p.item).type) : ''}`,
          sourceTruncated: p.truncated === true,
          ...event,
          sourcePath: path,
          sourceLine: line,
          ...(Number.isFinite(Date.parse(timestamp)) ? { timestamp } : {}),
          preview: event.text.slice(0, 1200),
          displayTruncated: event.text.length > 1200 || (event.output?.length ?? 0) > 1200,
          key: eventKey(base),
        };
        if (type === 'event_msg' && payloadType === 'item_completed') {
          const item = object(p.item);
          if (
            [
              'CommandExecution',
              'McpToolCall',
              'FileChange',
              'ImageView',
              'SubAgentActivity',
              'CollabAgentToolCall',
              ...(normalized.kind === 'ask' ? ['AgentMessage'] : []),
              'Extension',
            ].includes(string(item.type))
          ) {
            executionLinks.push({
              event: normalized,
              commands: item.type === 'CommandExecution' ? nativeCommandHash(item.command) : [],
              tools:
                item.type === 'McpToolCall'
                  ? [
                      toolSignature(
                        'mcp__' + string(item.server) + '__' + string(item.tool),
                        item.arguments,
                      ),
                    ].filter((value): value is string => !!value)
                  : [],
              nativeTool:
                item.type === 'McpToolCall'
                  ? {
                      name:
                        'mcp__' +
                        string(item.server) +
                        '__' +
                        string(item.tool).replace(/\./g, '_'),
                      args: item.arguments,
                    }
                  : undefined,
              nativeId: string(item.id),
              startedAt: typeof p.started_at_ms === 'number' ? p.started_at_ms : undefined,
            });
            if (item.type === 'CommandExecution')
              normalized.preview = executionCommand(item.command).slice(0, 1200);
          }
        } else if (
          type === 'response_item' &&
          ['function_call', 'custom_tool_call'].includes(payloadType)
        ) {
          const plan = /(^|[.])exec$/.test(normalized.title)
            ? wrapperTools(normalized.text)
            : { dynamic: [] };
          normalized.parallelCalls = plan.parallelCalls;
          normalized.sequentialCalls = plan.sequentialCalls;
          operations.set(normalized.key, semanticOperation(normalized.text, normalized.title, cwd));
          executionLinks.push({
            event: normalized,
            commands: commandHashes(normalized.text, normalized.title),
            dynamicTools: plan.dynamic,
            tools: toolSignatures(
              normalized.text,
              string(p.namespace)
                ? string(p.namespace) + '__' + normalized.title
                : normalized.title,
            ),
          });
        }
        if (
          type === 'response_item' &&
          /^(function_call_output|custom_tool_call_output)$/.test(payloadType)
        )
          executionLinks.push({ event: normalized, commands: [] });
        const signature = JSON.stringify([
          turnId,
          normalized.kind,
          createHash('sha256').update(normalized.text).digest('hex'),
        ]);
        if (nativeMessage)
          nativeMessages.push({ event: normalized, signature, images: event.imageUrls ?? [] });
        classifyRequest(normalized);
        if (options.lazyBodies && normalized.kind !== 'compaction') {
          normalized.body = {
            sources: [{ offset: record.offset, bytes: record.bytes, sha256: record.sha256 }],
            textLength: normalized.text.length,
            ...(normalized.output !== undefined ? { outputLength: normalized.output.length } : {}),
            imageCount: normalized.imageUrls?.length ?? 0,
          };
          normalized.text = normalized.text.slice(0, bodyPreviewSize);
          if (normalized.output !== undefined)
            normalized.output = normalized.output.slice(0, bodyPreviewSize);
          normalized.imageUrls = [];
        }
        // Remember the actual normalized object for envelope deduplication.
        if (!nativeMessage && (event.kind === 'request' || event.kind === 'message')) {
          const imageHashes = new Set(
            (event.imageUrls ?? []).map((url) => createHash('sha256').update(url).digest('hex')),
          );
          messages.set(signature, { from: type, event: normalized, imageHashes });
          canonicalEvents.set(signature, { event: normalized, imageHashes });
        }
        turn.events.push(normalized);
        thread.coverage.normalizedItems++;
        if (normalized.sourceTruncated) thread.coverage.truncatedItems++;
        if (normalized.displayTruncated) thread.coverage.displayTruncatedItems++;
      }
    }
    if (reviewModelSeen && !ordinaryModelSeen) thread.purpose = 'auto-review';
    for (const { event, signature, images } of nativeMessages) {
      if (!canonicalMessages.has(signature)) continue;
      const canonical = canonicalEvents.get(signature);
      if (canonical) canonical.event.messagePhase ??= event.messagePhase;
      if (canonical && images.length) {
        if (options.lazyBodies && canonical.event.body && event.body) {
          canonical.event.body.sources.push(...event.body.sources);
          for (const url of images)
            canonical.imageHashes.add(createHash('sha256').update(url).digest('hex'));
          canonical.event.body.imageCount = canonical.imageHashes.size;
        } else
          canonical.event.imageUrls = [
            ...new Set([...(canonical.event.imageUrls ?? []), ...images]),
          ];
      }
      const turn = turns.get(event.turnId)!;
      turn.events = turn.events.filter((candidate) => candidate !== event);
      thread.coverage.normalizedItems--;
      if (event.sourceTruncated) thread.coverage.truncatedItems--;
      if (event.displayTruncated) thread.coverage.displayTruncatedItems--;
      let group = thread.coverage.excludedItems.find(
        (item) => item.type === 'duplicate_completed_message',
      );
      if (!group)
        thread.coverage.excludedItems.push(
          (group = { type: 'duplicate_completed_message', count: 0, refs: [] }),
        );
      group.count++;
      group.refs.push({
        thread: event.threadId,
        turn: event.turnId,
        event: event.id,
        ordinal: event.ordinal,
      });
    }
    linkExecutions(executionLinks);
    for (const turn of thread.turns) {
      linkSemanticActions(turn.events, operations);
      linkCompactions(turn.events);
    }
    telemetry.apply(thread.turns);
    if (!identityVerified)
      throw new Error('Trace source lacks session metadata; refresh the usage dashboard.');
    thread.source.sha256 = hash.digest('hex');
    thread.source.lines = line;
    const after = await handle.stat();
    if (
      after.size < before.size ||
      (after.size === before.size && after.mtimeMs !== before.mtimeMs)
    )
      throw new Error('Trace source changed during reading; try again.');
    return thread;
  } finally {
    stream?.destroy();
    await handle.close();
  }
}
export function sessionTrace(threads: TraceThread[], session: string): ReviewDocument {
  return {
    version: 3,
    title: session.slice(0, 8),
    collectedAt: new Date().toISOString(),
    inputs: threads.map((thread) => ({ threadId: thread.id, sha256: thread.source.sha256 ?? '' })),
    threads,
    documents: [],
    media: [],
    delivery: { kind: 'local', session },
  };
}
