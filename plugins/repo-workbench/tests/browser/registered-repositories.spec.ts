import { test, expect } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, mkdir, realpath, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
test('standalone picker hot-loads registrations and preserves already-open repository targets', async ({
  context,
}) => {
  const temporary = await realpath(await mkdtemp(resolve(tmpdir(), 'workbench-launcher-')));
  const cli = resolve('dist/cli.mjs');
  const env = { ...process.env, XDG_CONFIG_HOME: resolve(temporary, 'config') };
  const repos = [];
  for (const name of ['alpha', 'beta']) {
    const repo = resolve(temporary, name);
    await mkdir(repo);
    execFileSync('git', ['init', '-q', repo]);
    await writeFile(resolve(repo, 'README.md'), name);
    repos.push(repo);
  }
  const run = (...args: string[]) =>
    execFileSync(process.execPath, [cli, ...args], { env, encoding: 'utf8' });
  run('repos', 'add', repos[0], '--name', 'Alpha');
  const child = spawn(process.execPath, [cli, 'serve', '--port', '0'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.resume();
  const closed = new Promise<void>((done) => child.once('close', () => done()));
  const lines = createInterface({ input: child.stdout });
  try {
    const url = await new Promise<string>((done, reject) => {
      const timeout = setTimeout(() => reject(new Error('Launcher did not start')), 10000);
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      lines.once('line', (line) => {
        clearTimeout(timeout);
        done((JSON.parse(line) as { url: string }).url);
      });
    });
    const picker = await context.newPage();
    await picker.goto(url);
    await expect(picker.getByRole('button', { name: /^Alpha/ })).toBeVisible();
    await expect(picker.getByRole('button', { name: /Retry/ })).toHaveCount(0);
    const opened = await context.newPage();
    await opened.goto(url);
    await opened.getByRole('button', { name: /^Alpha/ }).click();
    await expect(opened.locator('.checkout-path')).toHaveText(repos[0]);
    run('repos', 'add', repos[1], '--name', 'Beta');
    await expect(picker.getByRole('button', { name: /^Beta/ })).toBeVisible({ timeout: 10000 });
    await picker.getByRole('button', { name: /^Beta/ }).click();
    await expect(picker.locator('.checkout-path')).toHaveText(repos[1]);
    await expect(opened.locator('.checkout-path')).toHaveText(repos[0]);
    await opened.getByRole('button', { name: 'Save map', exact: true }).click();
    await expect(opened.getByText('✓ Shared document', { exact: true })).toBeVisible();
    const saved = JSON.parse(
      await readFile(resolve(repos[0], '.repo-canvas/architecture.json'), 'utf8'),
    ) as { title: string };
    expect(saved.title).toBe('alpha');
    run('repos', 'remove', repos[0]);
    const fresh = await context.newPage();
    await fresh.goto(url);
    await expect(fresh.getByRole('button', { name: /^Alpha/ })).toHaveCount(0);
    await expect(fresh.getByRole('button', { name: /^Beta/ })).toBeVisible();
    await opened.reload();
    await expect(opened.locator('.checkout-path')).toHaveText(repos[0]);
    const denied = await context.request.get(url + 'api/repositories', {
      headers: { Origin: 'https://unrelated.example' },
    });
    expect(denied.status()).toBe(403);
  } finally {
    lines.close();
    child.kill('SIGTERM');
    await closed;
    await rm(temporary, { recursive: true, force: true });
  }
});
