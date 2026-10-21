import { it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CanvasBridge } from './bridge';
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true })));
it('persists unsent context and pending request IDs across instances, isolates chats, rejects stale drafts and clears explicitly', () => {
  const directory = mkdtempSync(join(tmpdir(), 'discussion-test-'));
  roots.push(directory);
  const identity = { directory, repo: '/repo/a', chat: 'chat-one' };
  const a = new CanvasBridge(identity);
  const comment = {
    id: 'c',
    instruction: 'Investigate',
    target: { kind: 'node' as const, id: 'repo' },
    label: 'Repository',
    scope: 'repo',
    documentRevision: 'frozen',
    captured: '{"name":"old"}',
    sources: [],
  };
  a.discussion.write(0, 'Draft', [comment]);
  const b = new CanvasBridge(identity);
  expect(b.discussion.read().comments).toEqual([comment]);
  expect(() => b.discussion.write(0, 'stale', [])).toThrow('Conflict');
  expect(new CanvasBridge({ ...identity, chat: 'chat-two' }).discussion.read().composer).toBe('');
  expect(new CanvasBridge({ ...identity, repo: '/repo/b' }).discussion.read().comments).toEqual([]);
  const document = {
    version: 3 as const,
    title: 'test',
    modules: [
      {
        id: 'repo',
        parent: null,
        name: 'Repo',
        kind: 'system' as const,
        summary: '',
        sources: [],
        x: 0,
        y: 0,
      },
    ],
    connections: [],
    annotations: [],
  };
  const sent = a.enqueue('discussion', {
    document,
    scope: 'repo',
    selection: null,
    messages: [{ role: 'user', text: 'Review' }],
    comments: [comment],
  });
  expect(b.read(sent.id).context.comments).toEqual([comment]);
  expect(b.current('discussion')?.status).toBe('pending');
  expect(() => b.discussion.clear(b.discussion.read().revision)).toThrow('pending');
  b.reply(sent.id, { reply: 'Answer', proposal: null });
  expect(a.read(sent.id).status).toBe('answered');
  a.enqueue('discussion', {
    document,
    scope: 'repo',
    selection: null,
    messages: [{ role: 'user', text: 'Next' }],
  });
  expect(a.read(sent.id).response?.reply).toBe('Answer');
  const pending = a.current('discussion')!;
  a.cancel('discussion', pending.id);
  b.discussion.clear(b.discussion.read().revision);
  expect(a.discussion.read().history).toEqual([]);
  const folder = join(directory, 'repo-workbench', 'discussions');
  for (const file of readdirSync(folder))
    expect(statSync(join(folder, file)).mode & 0o777).toBe(0o600);
});
