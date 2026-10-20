import { gunzipSync } from 'node:zlib';
import { record, list, type Stage } from './contracts.ts';
import type { TestContext } from 'node:test';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildCase } from './build.ts';
import { writeFixture } from './fixture.ts';
async function fixture(t: TestContext) {
  const root = await mkdtemp(resolve(tmpdir(), 'trace-model-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return writeFixture(root);
}
await test('default trace output stays in repository cache and explicit output is never overwritten', async (t) => {
  const f = await fixture(t);
  const explicit = await buildCase(f);
  const cached = await buildCase({ ...f, output: undefined });
  assert.ok(
    cached.output.startsWith(
      resolve(await realpath(f.root), '.cache/repo-workbench/reviews') + '/',
    ),
  );
  assert.equal(existsSync(explicit.output), true);
  await assert.rejects(buildCase(f), /already exists/);
});
await test('cross-thread evidence resolves, deduplicates and produces factual summaries and artifact identities', async (t) => {
  const f = await fixture(t);
  f.spec.stages[0].evidence.push(f.spec.stages[0].evidence[1]);
  const d = await buildCase(f),
    s = d.stages[0];
  assert.equal(s.evidence.length, 6);
  assert.equal(s.facts.commands, 1);
  assert.equal(s.facts.verificationCommands, 1);
  assert.equal(s.facts.fileEdits, 1);
  assert.deepEqual(s.facts.changedFiles, ['src/bird.ts']);
  assert.deepEqual(s.facts.relatedThreads, ['worker', 'uncollected-worker']);
  assert.equal(d.artifacts[0].id, 'revision:bird');
  assert.equal(d.artifacts[0].provenance.sourcePairing, 'unknown');
  assert.equal(s.assessments[0].artifactId, d.artifacts[0].id);
  const manifest = record(JSON.parse(await readFile(resolve(f.output, 'manifest.json'), 'utf8')));
  const firstInput = record(list(manifest.inputs)[0]);
  const coverage = record(record(list(manifest.traceSources)[0]).coverage);
  const raw = await readFile(resolve(f.input, 'parent.json'));
  assert.equal(firstInput.sha256, createHash('sha256').update(raw).digest('hex'));
  assert.equal(record(list(coverage.unsupportedItems)[0]).count, 1);
});
await test('bad or absent evidence and malformed case records fail clearly', async (t) => {
  const f = await fixture(t),
    original = structuredClone(f.spec);
  const cases: Array<[(s: Stage) => void, RegExp]> = [
    [(s) => delete (s as Partial<Stage>).evidence, /Missing evidence/],
    [(s) => (s.evidence[0].thread = 'absent'), /Unknown evidence thread/],
    [(s) => (s.evidence[0].turn = 'absent'), /Unknown evidence turn/],
    [(s) => (s.evidence[0].event = 'absent'), /Unknown or excluded evidence event/],
    [(s) => (s.evidence[0].event = 'private'), /Unknown or excluded evidence event/],
    [(s) => (s.evidence[0].role = 'invented'), /Invalid evidence role/],
    [(s) => (s.assessments![0].evidence = []), /Assessment needs evidence/],
    [(s) => (s.actors![0].threadId = 'absent'), /Invalid episode actor/],
  ];
  for (const [change, pattern] of cases) {
    f.spec = structuredClone(original);
    change(f.spec.stages[0]);
    await assert.rejects(buildCase(f), pattern);
  }
});
await test('source paths are independent by default; explicit keys connect retained revisions and detect collisions', async (t) => {
  const f = await fixture(t);
  for (const [path, text] of [
    ['r1/a/index.ts', 'old'],
    ['r1/b/index.ts', 'other'],
    ['r2/a/index.ts', 'new'],
  ]) {
    await mkdir(resolve(f.root, 'test-results', path, '..'), { recursive: true });
    await writeFile(resolve(f.root, 'test-results', path), text);
  }
  const s = f.spec.stages[0];
  s.source = 'r1';
  f.spec.stages.push({ ...structuredClone(s), id: 'next', source: 'r2' });
  let d = await buildCase(f);
  assert.equal(d.stages[0].sources.length, 2);
  assert.equal(d.stages[1].sources[0].diff, null);
  f.spec.sourceKeys = {
    'test-results/r1/a/index.ts': 'model',
    'test-results/r2/a/index.ts': 'model',
  };
  f.output = resolve(f.root, 'compared-output');
  d = await buildCase(f);
  assert.ok(d.stages[1].sources[0].diff);
  assert.match(d.stages[1].sources[0].diff.text, /-old[\s\S]*\+new/);
  f.spec.sourceKeys['test-results/r1/b/index.ts'] = 'model';
  f.output = resolve(f.root, 'collision-output');
  await assert.rejects(buildCase(f), /sourceKey collision/);
});
await test('rejects path escapes including symlinks, hashes exact retained media bytes', async (t) => {
  const f = await fixture(t),
    s = f.spec.stages[0];
  s.source = '../../outside';
  await assert.rejects(buildCase(f), /inside repository/);
  s.source = null;
  s.capture = 'images';
  await mkdir(resolve(f.root, 'test-results/images'), { recursive: true });
  await writeFile(resolve(f.root, 'test-results/images/hydra-hero.png'), 'retained bytes');
  const d = await buildCase(f);
  assert.equal(d.media[0].sha256, createHash('sha256').update('retained bytes').digest('hex'));
  assert.equal(await readFile(resolve(f.output, d.media[0].url), 'utf8'), 'retained bytes');
  await symlink(tmpdir(), resolve(f.root, 'test-results/escape'));
  s.capture = 'escape';
  f.output = resolve(f.root, 'escape-output');
  await assert.rejects(buildCase(f), /inside repository/);
  s.capture = null;
  s.source = null;
  f.spec.documents = ['../outside'];
  await assert.rejects(buildCase(f));
});

await test('existing output, input overlap and symlinked destinations preserve their bytes', async (t) => {
  const f = await fixture(t);
  await buildCase(f);
  const original = await readFile(resolve(f.output, 'index.html'));
  await assert.rejects(buildCase(f), /Output already exists/);
  assert.deepEqual(await readFile(resolve(f.output, 'index.html')), original);
  await assert.rejects(buildCase({ ...f, output: f.input }), /must not overlap/);
  await assert.rejects(buildCase({ ...f, output: f.root }), /cannot be its root/);
  await symlink(tmpdir(), resolve(f.root, 'escape'));
  await assert.rejects(
    buildCase({ ...f, output: resolve(f.root, 'escape/new') }),
    /real directories/,
  );
  await assert.rejects(
    buildCase({ ...f, output: resolve(f.root, '../escape') }),
    /inside repository/,
  );
});

await test('malformed input contracts fail before publication and failed builds leave no bundle', async (t) => {
  const f = await fixture(t);
  for (const spec of [
    null,
    { ...f.spec, threads: 'not an array' },
    { ...f.spec, stages: [{ ...f.spec.stages[0], capture: 42 }] },
    { ...f.spec, stages: [{ ...f.spec.stages[0], artifactEvidence: { bird: false } }] },
  ]) {
    await assert.rejects(buildCase({ ...f, spec }), /Expected/);
    assert.equal(existsSync(f.output), false);
  }
  f.spec.stages[0].evidence[0].event = 'missing';
  await assert.rejects(buildCase(f), /Unknown or excluded evidence/);
  assert.equal(existsSync(f.output), false);
});

await test('package CLI resolves declared inputs independently of the working directory', async (t) => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  await mkdir(resolve(root, 'test-results'), { recursive: true });
  const fixtureRoot = await mkdtemp(resolve(root, 'test-results/trace-cli-'));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const f = await writeFixture(fixtureRoot);
  const specPath = resolve(fixtureRoot, 'case.json');
  await writeFile(specPath, JSON.stringify(f.spec));
  const stdout = execFileSync(
    process.execPath,
    [
      resolve(root, 'packages/runtime/cli.ts'),
      'trace',
      '--repo',
      fixtureRoot,
      '--input',
      f.input,
      '--out',
      f.output,
      '--case',
      specPath,
    ],
    { cwd: tmpdir(), encoding: 'utf8' },
  );
  const receipt = record(JSON.parse(stdout));
  assert.equal(receipt.threads, 2);
  assert.equal(receipt.episodes, 1);
  assert.ok(existsSync(resolve(f.output, 'index.html')));
});

await test('document pins retain exact Git bytes after edits or removal and never fall back', async (t) => {
  const f = await fixture(t);
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', f.root, ...args], { encoding: 'utf8' }).trim();
  git('init', '--quiet');
  await mkdir(resolve(f.root, 'docs'));
  const original = 'Historical review: rejected. User approval remains unrecorded.\n';
  await writeFile(resolve(f.root, 'docs/review.md'), original);
  await symlink('review.md', resolve(f.root, 'docs/link.md'));
  git('add', 'docs/review.md', 'docs/link.md');
  git(
    '-c',
    'user.name=Trace fixture',
    '-c',
    'user.email=fixture@example.invalid',
    '-c',
    'commit.gpgsign=false',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '--quiet',
    '-m',
    'Retain review',
  );
  const revision = git('rev-parse', 'HEAD');
  f.spec.documents = [{ path: 'docs/review.md', revision }];
  await writeFile(resolve(f.root, 'docs/review.md'), 'Current text differs.');
  const first = await buildCase(f);
  assert.equal(first.documents[0].text, original);
  assert.equal(first.documents[0].revision, revision);
  assert.equal(first.documents[0].sha256, createHash('sha256').update(original).digest('hex'));
  await rm(resolve(f.root, 'docs/review.md'));
  f.output = resolve(f.root, 'removed-output');
  assert.equal((await buildCase(f)).documents[0].text, original);
  f.output = resolve(f.root, 'rejected-output');
  for (const document of [
    { path: 'docs/review.md', revision: '0'.repeat(40) },
    { path: 'docs/absent.md', revision },
    { path: 'docs/link.md', revision },
    { path: '../outside.md', revision },
    { path: 'docs/review.md', revision: 'HEAD' },
    { path: 'docs/review.md', revision: git('rev-parse', `${revision}:docs/review.md`) },
  ]) {
    f.spec.documents = [document];
    await assert.rejects(buildCase(f), /pinned document|Pinned document|Expected/);
    assert.equal(existsSync(f.output), false);
  }
});

await test('viewer payloads remain inert through runtime insertion and story prose is validated', async (t) => {
  const f = await fixture(t);
  f.spec.title = '/*TRACE_RUNTIME*/ </script><script>throw new Error("injected")</script>';
  const data = await buildCase(f);
  const html = await readFile(resolve(data.output, 'index.html'), 'utf8');
  assert.equal((html.match(/<script\b/g) ?? []).length, 2);
  const payload = html.match(/<script id="trace-data"[^>]*>([^<]+)<\/script>/)?.[1];
  assert.ok(payload);
  const decoded = JSON.parse(gunzipSync(Buffer.from(payload, 'base64')).toString()) as {
    title: string;
  };
  assert.equal(decoded.title, f.spec.title);
  assert.ok(!html.includes(f.spec.title));
  for (const spec of [
    { ...f.spec, outcome: { approval: 'invented' } },
    { ...f.spec, stages: [{ ...f.spec.stages[0], status: ['ambiguous'] }] },
    { ...f.spec, stages: [{ ...f.spec.stages[0], finding: 42 }] },
  ]) {
    await assert.rejects(
      buildCase({ ...f, output: resolve(f.root, 'invalid-story'), spec }),
      /Expected/,
    );
  }
});
