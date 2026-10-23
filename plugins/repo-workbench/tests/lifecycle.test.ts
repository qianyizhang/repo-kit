import { writeFixture } from '../packages/trace/fixture.ts';
import { buildCase } from '../packages/trace/build.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readdir, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DiscussionStore } from '../packages/repo-canvas/src/server/discussion.ts';
import { reviewDocumentSchema } from '../packages/session-review/src/model/document.ts';
import { sessionTrace, normalizeSessionFile } from '../packages/trace/jsonl.ts';
import { createFixture } from '../packages/usage/fixture.ts';

void test('discussion transaction survives a killed writer and preserves revision checks', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'discussion-crash-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const identity = { directory, repo: '/fixture', chat: 'chat' };
  const store = new DiscussionStore(identity);
  store.write(0, 'before crash', []);
  const folder = join(directory, 'repo-workbench', 'discussions');
  const file = (await readdir(folder)).find((name) => name.endsWith('.json'))!;
  await mkdir(join(folder, file + '.lock')); // A legacy orphan is neither trusted nor removed.
  const module = resolve('packages/repo-canvas/src/server/discussion.ts');
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import {DiscussionStore} from ${JSON.stringify(module)}; new DiscussionStore(${JSON.stringify(identity)}).change(value=>{process.stdout.write('locked\\n'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0); return value;});`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  t.after(() => {
    child.kill('SIGKILL');
  });
  await Promise.race([
    once(child.stdout, 'data'),
    once(child, 'exit').then(() => {
      throw new Error('Writer exited before taking the lock');
    }),
  ]);
  assert.throws(() => store.write(1, 'competing', []), /Conflict/);
  const exited = once(child, 'exit');
  child.kill('SIGKILL');
  await exited;
  const recovered = new DiscussionStore(identity);
  assert.equal(recovered.read().composer, 'before crash');
  recovered.write(1, 'recovered', []);
  assert.equal(store.read().composer, 'recovered');
  assert.throws(() => store.write(1, 'stale', []), /Conflict/);
});
void test('canonical trace parser rejects nested corruption and accepts actual lazy data', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'trace-parser-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await createFixture(root);
  const thread = await normalizeSessionFile(join(root, 'parent.jsonl'), 'parent', 'Selected', {
    lazyBodies: true,
  });
  const document = sessionTrace([thread], 'parent');
  assert.equal(reviewDocumentSchema.safeParse(document).success, true);
  for (const bad of [
    null,
    { ...document, threads: [null] },
    { ...document, threads: [{ ...thread, turns: [null] }] },
    { ...document, threads: [{ ...thread, turns: [{ ...thread.turns[0], events: [null] }] }] },
  ])
    assert.equal(reviewDocumentSchema.safeParse(bad).success, false);
  const malformed = structuredClone(document);
  const event = malformed.threads[0].turns.flatMap((t) => t.events).find((e) => e.body)!;
  event.body!.sources[0].bytes = -1;
  assert.equal(reviewDocumentSchema.safeParse(malformed).success, false);
});

void test('authored v2 review exports retain their curated evidence under the canonical parser', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'curated-parser-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const data = await buildCase(await writeFixture(root));
  const { stages: episodes, artifacts, ...recorded } = data;
  const document = { ...recorded, curation: { episodes, artifacts } };
  assert.equal(document.version, 2);
  assert.equal(reviewDocumentSchema.safeParse(document).success, true);
  assert.equal(reviewDocumentSchema.safeParse({ ...document, version: 4 }).success, false);
});
