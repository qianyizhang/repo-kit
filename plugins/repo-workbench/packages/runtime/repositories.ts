import { homedir } from 'node:os';
import { resolve, dirname, basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, rename, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
export type RegisteredRepository = { id: string; path: string; name: string; available: boolean };
export function registryFile() {
  return resolve(
    process.env.XDG_CONFIG_HOME ?? resolve(homedir(), '.config'),
    'repo-workbench/repositories.json',
  );
}
async function records(file: string): Promise<Array<{ path: string; name: string }>> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const value: unknown = JSON.parse(text);
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('repositories' in value) ||
    !Array.isArray(value.repositories)
  )
    throw new Error('Unsupported repository registry');
  return value.repositories.map((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !('path' in entry) ||
      typeof entry.path !== 'string' ||
      !entry.path.startsWith('/') ||
      !('name' in entry) ||
      typeof entry.name !== 'string'
    )
      throw new Error('Invalid repository registry entry');
    return { path: entry.path, name: entry.name };
  });
}
export async function registeredRepositories(
  file = registryFile(),
): Promise<RegisteredRepository[]> {
  return Promise.all(
    (await records(file)).map(async (entry) => ({
      ...entry,
      id: createHash('sha256').update(entry.path).digest('hex').slice(0, 24),
      available: await realpath(entry.path).then(
        (path) => path === entry.path,
        () => false,
      ),
    })),
  );
}
export async function registerRepository(path: string, name?: string, file = registryFile()) {
  const canonical = await realpath(resolve(path));
  const root = await realpath(
    execFileSync('git', ['-C', canonical, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim(),
  );
  const entries = await records(file);
  const existing = entries.find((entry) => entry.path === root);
  if (existing) existing.name = name ?? existing.name;
  else entries.push({ path: root, name: name ?? basename(root) });
  await save(entries, file);
  return root;
}
export async function unregisterRepository(path: string, file = registryFile()) {
  const requested = resolve(path),
    canonical = await realpath(requested).catch(() => requested);
  await save(
    (await records(file)).filter((entry) => entry.path !== canonical),
    file,
  );
}
async function save(entries: Array<{ path: string; name: string }>, file: string) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = file + '.' + randomUUID() + '.tmp';
  await writeFile(
    temporary,
    JSON.stringify({ version: 1, repositories: entries }, null, 2) + '\n',
    { mode: 0o600, flag: 'wx' },
  );
  await rename(temporary, file);
}
