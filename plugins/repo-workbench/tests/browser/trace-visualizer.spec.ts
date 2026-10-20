import { relative, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';

const fixtureRoots = new Set<string>();
async function fixtureDirectory(prefix: string) {
  await mkdir('test-results', { recursive: true });
  const root = await mkdtemp(resolve('test-results', prefix));
  fixtureRoots.add(root);
  return root;
}
test.afterAll(async () => {
  await Promise.all([...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })));
  fixtureRoots.clear();
});

function bundleUrl(json: string): string {
  const value: unknown = JSON.parse(json);
  if (!value || typeof value !== 'object' || !('file' in value) || typeof value.file !== 'string')
    throw new Error('Expected trace bundle path');
  const path = relative(process.cwd(), value.file);
  if (path === '..' || path.startsWith('..' + sep))
    throw new Error('Trace bundle escaped repository');
  return '/' + path.split(sep).join('/');
}
test.describe('public synthetic behavior case', () => {
  let fixtureUrl = '';
  test.beforeAll(async () => {
    const root = await fixtureDirectory('trace-public-fixture-');
    fixtureUrl = bundleUrl(
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `
      import {writeFixture} from './packages/trace/fixture.ts';
      import {buildCase} from './packages/trace/build.ts';
      import {resolve} from 'node:path';
      const root = process.argv[1];
      const data = await buildCase(await writeFixture(root));
      console.log(JSON.stringify({file: resolve(data.output, 'index.html')}));
    `,
          root,
        ],
        { encoding: 'utf8' },
      ),
    );
  });
  test('episode evidence selects an exact cross-thread event and retains artifact context', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(fixtureUrl);
    await expect(page.locator('#coverage-summary')).toContainText('1 unsupported');
    await expect(page.locator('#ownership')).toContainText('construction');
    await expect(page.locator('#ownership')).toContainText('exact interleaving unavailable');
    await expect(page.locator('#story-images')).toContainText('No retained hero capture');
    await expect(page.locator('#episode-evidence .evidence-row')).toHaveCount(6);
    await page
      .locator('#episode-evidence')
      .getByRole('button', { name: /edit.*Recorded file changes/ })
      .click();
    await expect(page.locator('#drawer-content')).toContainText('Source truncated upstream');
    await expect(page.locator('#story-images')).toBeVisible();
    await page.getByRole('button', { name: 'Open exact recorded action' }).click();
    await expect(page.locator('#event-list .selected-event')).toContainText('src/bird.ts');
    await expect(page.locator('#action-context')).toContainText('Wing review');
    await page.reload();
    await expect(page.locator('#drawer-content')).toContainText('src/bird.ts');
    await page.keyboard.press('Escape');
    await page
      .getByRole('combobox', { name: 'Evidence role', exact: true })
      .selectOption('verification');
    await expect(page.locator('#event-list .event')).toHaveCount(1);
    await page.getByRole('button', { name: 'Inspect evidence', exact: true }).click();
    await expect(page.locator('#drawer-content')).not.toContainText('Viewer preview shortened');
    await expect(page.locator('#drawer-content')).not.toContainText('Source truncated upstream');
    await expect(
      page
        .locator('#drawer-content pre:not(.record-preview)')
        .filter({ hasText: 'Complete available output.' }),
    ).toContainText('x'.repeat(17000));
    await page.keyboard.press('Escape');
    await page.getByRole('combobox', { name: 'Evidence role', exact: true }).selectOption('all');
    await page.getByRole('combobox', { name: 'Agent', exact: true }).selectOption('worker');
    await page.getByRole('slider', { name: 'Turn', exact: true }).fill('1');
    await expect(page.locator('#turn-position')).toContainText('Worker');
    await expect(page.locator('#action-context')).toContainText('Turn start time unknown');
    await expect(page.locator('#event-list')).toContainText('src/bird.ts');
    expect(errors).toEqual([]);
  });
  test('episode selection adds history and restores the selected episode on reload', async ({
    page,
  }) => {
    const root = await fixtureDirectory('episode-history-');
    const historyUrl = bundleUrl(
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `
      import {writeFixture} from './packages/trace/fixture.ts';
      import {buildCase} from './packages/trace/build.ts';
      import {resolve} from 'node:path';
      const root = process.argv[1];
      const options = await writeFixture(root);
      options.spec.stages.push({...options.spec.stages[0], id:'followup', title:'Follow-up review'});
      const data = await buildCase(options);
      console.log(JSON.stringify({file:resolve(data.output,'index.html')}));
    `,
          root,
        ],
        { encoding: 'utf8' },
      ),
    );
    await page.goto(historyUrl);
    await expect(page.locator('#stage-title')).toHaveText('Wing review');
    const length = await page.evaluate(() => history.length);
    await page.getByRole('button', { name: 'Next episode →', exact: true }).click();
    await expect(page.locator('#stage-title')).toHaveText('Follow-up review');
    expect(await page.evaluate(() => history.length)).toBe(length + 1);
    await page.goBack();
    await expect(page.locator('#stage-title')).toHaveText('Wing review');
    await page.goForward();
    await expect(page.locator('#stage-title')).toHaveText('Follow-up review');
    await page.reload();
    await expect(page.locator('#stage-title')).toHaveText('Follow-up review');
  });
  test('browser history restores URL-linked curated evidence across views', async ({ page }) => {
    await page.goto(fixtureUrl);
    await page.locator('#episode-evidence .evidence-row').first().click();
    await expect(page.locator('#evidence-drawer')).toBeVisible();
    await page.getByRole('button', { name: 'Open exact recorded action' }).click();
    await expect(page.locator('#evidence-drawer')).toBeHidden();
    await expect(page.locator('#events')).toBeVisible();
    await page.goBack();
    await expect(page.locator('#story')).toBeVisible();
    await expect(page.locator('#evidence-drawer')).toBeVisible();
    await page.goForward();
    await expect(page.locator('#events')).toBeVisible();
    await expect(page.locator('#drawer-content')).toContainText('Revise the wing');
  });
  test('criterion cells expose assessor, artifact and limits; coverage preserves omitted identities', async ({
    page,
  }) => {
    await page.goto(fixtureUrl);
    await page.getByRole('button', { name: 'Compare revisions', exact: true }).click();
    await page
      .locator('#criterion-matrix')
      .getByRole('button', { name: 'issue · reviewer' })
      .click();
    await expect(page.locator('#drawer-content')).toContainText('Parent');
    await expect(page.locator('#drawer-content')).toContainText('Artifact revision: revision:bird');
    await page.locator('#drawer-content .evidence-row').click();
    await expect(page.locator('#drawer-content')).toContainText(
      'Wing attachment still needs revision.',
    );
    await page.keyboard.press('Escape');
    await page
      .locator('#criterion-matrix')
      .getByRole('button', { name: 'unrecorded · record limit' })
      .click();
    await expect(page.locator('#drawer-content')).toContainText('No supporting event recorded.');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Source & provenance', exact: true }).click();
    await page
      .locator('#coverage-details summary')
      .filter({ hasText: 'Parent · ReadThread' })
      .click();
    await expect(page.locator('#coverage-details')).toContainText('futureEvent ×1');
    await page.getByText('Unsupported: futureEvent ×1', { exact: true }).click();
    await expect(page.locator('#coverage-details')).toContainText('parent / turn / unknown');
    await expect(page.locator('body')).not.toContainText('Do not expose this');
  });
  test('process map filters authored lessons and exports notes with exact evidence links', async ({
    page,
  }, info) => {
    await page.goto(fixtureUrl);
    await page.getByRole('button', { name: 'Process map', exact: true }).click();
    await expect(page.locator('#process-count')).toContainText('1 of 1');
    await page
      .getByRole('combobox', { name: 'Show episodes', exact: true })
      .selectOption('lessons');
    await page.getByLabel('Find an episode or lesson').fill('acceptance');
    await page.reload();
    await expect(page.getByLabel('Find an episode or lesson')).toHaveValue('acceptance');
    await expect(page.locator('#process-list')).toContainText('Tests and acceptance differ.');
    await page
      .locator('#process-list')
      .getByRole('button', { name: /Inspection/ })
      .click();
    await expect(page.locator('#drawer-content .evidence-row')).toHaveCount(2);
    await page
      .locator('#drawer-content')
      .getByRole('button', { name: /verification/ })
      .click();
    await expect(page.locator('#drawer-content')).toContainText('npm test');
    await page.keyboard.press('Escape');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download learning notes' }).click();
    const file = info.outputPath('learning-notes.md');
    await (await download).saveAs(file);
    const notes = readFileSync(file, 'utf8');
    expect(notes).toContain('Lesson: Tests and acceptance differ.');
    expect(notes).toContain('worker / turn / check');
    expect(notes).toContain('./index.html#episode=revision');
    expect(notes).not.toContain('Complete available output.');
    await page.getByLabel('Find an episode or lesson').fill('absent lesson');
    await expect(page.locator('#process-list')).toContainText('No curated episodes match');
    await expect(page.getByRole('button', { name: 'Download learning notes' })).toBeDisabled();
    await page.getByLabel('Find an episode or lesson').fill('');
    await page.getByRole('button', { name: 'Open episode', exact: true }).click();
    await expect(page.locator('#stage-title')).toHaveText('Wing review');
  });
  test('mobile evidence drawer and views do not overflow', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixtureUrl);
    for (const view of [
      'Conversation',
      'Process map',
      'Creation story',
      'Compare revisions',
      'Recorded actions',
      'Source & provenance',
    ]) {
      await page.getByRole('button', { name: view, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.getByRole('button', { name: 'Creation story', exact: true }).click();
    await page.locator('#episode-evidence .evidence-row').first().click();
    await expect(page.getByRole('button', { name: 'Close evidence ×' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath('evidence-phone.png') });
    await page.keyboard.press('Escape');
    await expect(page.locator('#evidence-drawer')).toBeHidden();
  });
});

test.describe('conversation overview and turn inspection', () => {
  let url = '';
  test.beforeAll(async () => {
    const root = await fixtureDirectory('conversation-fixture-');
    url = bundleUrl(
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `
      import {writeFile} from 'node:fs/promises';
      import {resolve} from 'node:path';
      import {renderReview} from './packages/session-review/build.ts';
      import {normalizeSessionFile, sessionTrace} from './packages/trace/jsonl.ts';
      const root = process.argv[1];
      const row = (type, payload) => ({type, payload, timestamp:'2026-10-09T01:00:00Z'});
      const message = (role, text, phase) => row('response_item', {type:'message',role,phase,content:[{type:'input_text',text}]});
      const rows = [row('session_meta',{id:'conversation-fixture'}), row('turn_context',{turn_id:'first'}),
        message('user','# AGENTS.md instructions for /fixture\\n<INSTRUCTIONS>\\nCONTEXT_ONLY_MARKER\\n</INSTRUCTIONS>'),
        message('developer','<app-context>\\nSYSTEM_CONTEXT_MARKER\\n</app-context>'),
        message('user','Repair **the wing**.\\n\\n<INSTRUCTIONS>\\n## Local context\\nThese manually wrapped\\nlines should read as one paragraph.\\n\\n<environment_context>\\nFolded context details.\\n</environment_context>\\n\\n' + 'Long context '.repeat(350) + 'CONTEXT_TAIL\\n</INSTRUCTIONS>'),
        message('assistant','Inspecting the attachment.','commentary'),
        row('response_item',{type:'custom_tool_call',name:'functions.exec',call_id:'batch',input:'const results=await Promise.allSettled([tools.exec_command({cmd:"node check.js"})]);results.forEach(r=>text(r));'}),
        row('response_item',{type:'function_call',name:'exec_command',call_id:'inspect',arguments:JSON.stringify({cmd:'node check.js',cwd:'/fixture'})}),
        message('user','Keep the existing silhouette.'),
        row('response_item',{type:'function_call_output',call_id:'inspect',output:'Script completed\\nWall time 0.5 seconds\\nOutput:\\nCHECK_PASSED\\n<svg onload="throw new Error()">'}),
        message('assistant','**Attachment repaired.** Checks passed.\\n\\n| Status | Entries |\\n| --- | ---: |\\n| Reviewed | 13 / 205 |\\n\\n- First item\\n- Second item\\n\\n[Reference](https://example.com/trace)\\n\\n<oai-mem-citation>\\nAncillary citation metadata.\\n</oai-mem-citation>\\n\\n<img src="https://example.com/unrequested.png" onerror="throw new Error()">','final_answer'),
        row('turn_context',{turn_id:'unfinished'}),message('user','Now inspect the tail.')];
      for(let i=0;i<23;i++) rows.push(row('turn_context',{turn_id:'later-'+i}),message('user','Later request '+i),message('assistant','Later response '+i,'final_answer'));
      const path = resolve(root,'session.jsonl');
      await writeFile(path, rows.map(JSON.stringify).join('\\n'));
      const thread = await normalizeSessionFile(path,'conversation-fixture','Selected session');
      const html = await renderReview(sessionTrace([thread],'conversation-fixture'));
      const file = resolve(root,'index.html'); await writeFile(file,html);
      console.log(JSON.stringify({file}));
    `,
          root,
        ],
        { encoding: 'utf8' },
      ),
    );
  });
  test('browser traversal restores turns and views while filter edits replace one entry', async ({
    page,
  }) => {
    await page.goto(url);
    await page
      .locator('#conversation-list > article')
      .first()
      .getByRole('button', { name: 'Inspect turn' })
      .click();
    await expect(page.locator('#turn-title')).toHaveText('Turn 1');
    const length = await page.evaluate(() => history.length);
    await page.locator('#turn-kind').selectOption('command');
    await page.getByRole('switch', { name: 'Raw text' }).check();
    expect(await page.evaluate(() => history.length)).toBe(length);
    await page.getByRole('button', { name: 'Next turn →', exact: true }).click();
    await expect(page.locator('#turn-title')).toHaveText('Turn 2');
    await expect(page.locator('#turn-kind')).toHaveValue('all');
    await page.goBack();
    await expect(page.locator('#turn-title')).toHaveText('Turn 1');
    await expect(page.locator('#turn-kind')).toHaveValue('command');
    await expect(page.getByRole('switch', { name: 'Raw text' })).toBeChecked();
    await page.goBack();
    await expect(page.locator('#conversation-list')).toBeVisible();
    await page.goForward();
    await expect(page.locator('#turn-title')).toHaveText('Turn 1');
    await page.getByRole('button', { name: 'Recorded actions', exact: true }).click();
    await expect(page.locator('#events')).toBeVisible();
    await page.goBack();
    await expect(page.locator('#turn-title')).toHaveText('Turn 1');
    await page.reload();
    await expect(page.locator('#turn-kind')).toHaveValue('command');
  });
  test('starts with exchanges, drills into structured work, and restores the selected turn', async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    await expect(page.locator('#conversation')).toBeVisible();
    await expect(page.locator('#conversation-list > article')).toHaveCount(20);
    const first = page.locator('#conversation-list > article').first();
    await expect(first).toContainText('Assistant response · final');
    await expect(first).not.toContainText('CONTEXT_ONLY_MARKER');
    await expect(first).toContainText('+1 further user messages');
    await expect(first.locator('strong')).toContainText(['the wing', 'Attachment repaired.']);
    await page.getByLabel('About conversation search', { exact: true }).hover();
    await expect(
      page.getByRole('tooltip').filter({ hasText: 'Filters turns by words' }),
    ).toBeVisible();
    await first.getByRole('button', { name: 'Inspect turn' }).click();
    await expect(page.locator('#turn-pair')).toContainText('Keep the existing silhouette.');
    await expect(page.locator('#turn-work')).not.toContainText('SYSTEM_CONTEXT_MARKER');
    await page.getByText('Session context (2 records)', { exact: true }).click();
    await expect(page.locator('.session-context')).toContainText('CONTEXT_ONLY_MARKER');
    await page.getByText('Session context (2 records)', { exact: true }).click();
    await expect(page.locator('#conversation-count')).toBeHidden();
    await expect(page.locator('#turn-pair table')).toContainText('13 / 205');
    await expect(page.locator('#turn-pair li')).toHaveCount(2);
    await expect(page.locator('#turn-pair .xml-section > summary')).toContainText([
      'INSTRUCTIONS',
      'environment_context',
      'oai-mem-citation',
    ]);
    await expect(
      page.locator('#turn-pair').getByText('environment_context', { exact: true }).locator('..'),
    ).not.toHaveAttribute('open', '');
    await expect(page.locator('#turn-pair')).toContainText('CONTEXT_TAIL');
    await expect(
      page.locator('#turn-pair p').filter({ hasText: 'These manually wrapped' }),
    ).toHaveText('These manually wrapped lines should read as one paragraph.');
    await expect(page.locator('#turn-pair img')).toHaveCount(0);
    await expect(page.getByText('Full recorded text', { exact: true })).toHaveCount(0);
    await expect(page.locator('#turn-work .tool-meta')).toContainText('Wall time 0.5 seconds');
    await expect(page.locator('#turn-work .code-block')).toContainText([
      'node check.js',
      '/fixture',
      'CHECK_PASSED',
    ]);
    await expect(page.locator('#turn-work .hljs-keyword')).not.toHaveCount(0);
    await page.getByRole('switch', { name: 'Raw text', exact: true }).check();
    await expect(page.locator('#turn-pair .raw-text')).toContainText([
      '**the wing**',
      'Keep the existing silhouette.',
      '| Status | Entries |',
    ]);
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Raw text', exact: true })).toBeChecked();
    await page.getByRole('switch', { name: 'Raw text', exact: true }).uncheck();
    await page.locator('#turn-kind').selectOption('result');
    await expect(page.locator('#turn-work > article')).toHaveCount(1);
    await expect(page.locator('#turn-work')).toContainText('CHECK_PASSED');
    await page.locator('#turn-kind').selectOption('all');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Copy full session ID', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('conversation-fixture');
    const coverage = page.locator('#coverage-summary .help-target').first();
    await coverage.focus();
    await expect(coverage.getByRole('tooltip')).toBeVisible();

    await expect(page.locator('#turn-work dt').first()).toHaveText('cmd');
    await expect(page.locator('#turn-work dd').first()).toHaveText('node check.js');
    await expect(page.locator('#turn-work')).toContainText('CHECK_PASSED');
    await expect(page.locator('#turn-work svg')).toHaveCount(0);
    // Identical command text in a different call is not enough to merge the unpaired wrapper.
    const pairedCall = page.locator('#turn-work > article').filter({ hasText: 'CHECK_PASSED' });
    await expect(pairedCall).toHaveCount(1);
    await expect(pairedCall).toContainText('node check.js');
    await pairedCall.locator(':scope > details > .action-summary').click();
    await expect(
      pairedCall.locator('.code-block').filter({ hasText: 'CHECK_PASSED' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jump to tool result' })).toHaveCount(0);
    await expect(page.getByText('Source & identity', { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.locator('#turn-detail')).toBeVisible();
    await expect(page.locator('#turn-title')).toHaveText('Turn 1');
    await page.screenshot({ path: info.outputPath('conversation-turn.png'), fullPage: true });
    await page.getByRole('button', { name: 'Next turn →', exact: true }).click();
    await expect(page.locator('#turn-pair')).toContainText('Assistant message not recorded.');
    await expect(page.locator('#turn-pair')).toContainText('Final status unavailable.');
    await page.getByRole('button', { name: '← Conversation overview', exact: true }).click();
    await page.getByRole('button', { name: 'Later turns →', exact: true }).click();
    await expect(page.locator('#conversation-list > article')).toHaveCount(5);
    await page.reload();
    await expect(page.locator('#conversation-count')).toContainText('page 2 / 2');
    await page.getByLabel('Find a request or response').fill('Later request 22');
    await expect(page.locator('#conversation-list > article')).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Inspect turn' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath('conversation-phone.png'), fullPage: true });
    expect(errors).toEqual([]);
  });
});
