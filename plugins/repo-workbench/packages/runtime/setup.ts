import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, readFile, rename, writeFile, realpath, lstat, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { configuration, projectConfig, workbenchPlugins } from './project-config.ts';
declare const WORKBENCH_BUNDLED: boolean;
const packageRoot = fileURLToPath(
  new URL(typeof WORKBENCH_BUNDLED !== 'undefined' ? '../' : '../../', import.meta.url),
);
async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
      return undefined;
    throw error;
  }
}
function within(root: string, path: string) {
  const child = relative(root, path);
  return child !== '..' && !child.startsWith('..' + sep) && !isAbsolute(child);
}
async function writablePath(root: string, file: string) {
  for (let path = file; path !== root; path = dirname(path)) {
    try {
      const info = await lstat(path);
      if (info.isSymbolicLink() || !within(root, await realpath(path)))
        throw new Error(`Setup refuses a symlinked configuration path: ${path}`);
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT')
        throw error;
    }
  }
}
/** Register the package and apply repo-only precedence without changing user configuration. */
export async function setup(
  args: string[],
  installedRoot = packageRoot,
  environment = {
    home: homedir(),
    codexHome: process.env.CODEX_HOME ?? resolve(homedir(), '.codex'),
  },
) {
  let scope = 'user',
    repo = process.cwd();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i],
      value = args[i + 1];
    if (!['--scope', '--repo'].includes(key) || !value)
      throw new Error('Use setup --scope user|repo [--repo DIR]');
    if (key === '--scope') scope = value;
    else repo = resolve(value);
  }
  if (!['user', 'repo'].includes(scope)) throw new Error('Scope must be user or repo');
  const root = await realpath(scope === 'user' ? environment.home : repo);
  const source = await realpath(installedRoot),
    path = relative(root, source);
  if (!path || isAbsolute(path) || path === '..' || path.startsWith('..' + sep))
    throw new Error(`Install the npm package inside ${root} first, then run its setup command.`);
  const file = resolve(root, '.agents/plugins/marketplace.json');
  await writablePath(root, file);
  const originalCatalog = await readOptional(file);
  let catalog: { name: string; plugins: Array<Record<string, unknown>>; [key: string]: unknown } = {
    name:
      scope === 'user'
        ? 'repo-kit'
        : `repo-kit-${createHash('sha256').update(root).digest('hex').slice(0, 12)}`,
    plugins: [],
  };
  const parsed: unknown = originalCatalog === undefined ? catalog : JSON.parse(originalCatalog);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('name' in parsed) ||
    typeof parsed.name !== 'string' ||
    !('plugins' in parsed) ||
    !Array.isArray(parsed.plugins)
  )
    throw new Error('Existing marketplace has an unsupported format');
  catalog = parsed as typeof catalog;
  const entry = {
    name: 'repo-workbench',
    source: { source: 'local', path: './' + path.split(sep).join('/') },
    policy: { installation: 'AVAILABLE', authentication: 'ON_USE' },
    category: 'Developer Tools',
  };
  const prior = catalog.plugins.findIndex((plugin) => plugin?.name === 'repo-workbench');
  if (prior < 0) catalog.plugins.push(entry);
  else catalog.plugins[prior] = { ...catalog.plugins[prior], ...entry };
  const plugin = `repo-workbench@${catalog.name}`;
  const configFile = resolve(root, '.codex/config.toml');
  const changes: Array<{ file: string; before: string | undefined; after: string }> = [
    { file, before: originalCatalog, after: JSON.stringify(catalog, null, 2) + '\n' },
  ];
  let disabled: string[] = [];
  if (scope === 'repo') {
    await writablePath(root, configFile);
    const userFile = resolve(environment.codexHome, 'config.toml');
    const userDirectory = await realpath(environment.codexHome).catch(() =>
      resolve(environment.codexHome),
    );
    if (root === (await realpath(environment.home)) || dirname(configFile) === userDirectory)
      throw new Error(
        'Repository setup cannot target the user configuration directory. Use --scope user.',
      );
    const user = configuration((await readOptional(userFile)) ?? '');
    const original = await readOptional(configFile);
    const local = configuration(original ?? '');
    const userPlugins = workbenchPlugins(user);
    if (userPlugins.includes(plugin))
      throw new Error(
        'Repository marketplace name collides with a user Workbench identity. Choose a distinct marketplace name before running repo setup.',
      );
    disabled = [...new Set([...userPlugins, ...workbenchPlugins(local)])]
      .filter((id) => id !== plugin)
      .sort();
    changes.push({
      file: configFile,
      before: original,
      after: projectConfig(original ?? '', plugin, disabled),
    });
  }
  const pending = changes.filter((change) => change.before !== change.after);
  // Validate both files before touching either. A retry completes an interrupted two-file update.
  for (const change of pending) {
    if ((await readOptional(change.file)) !== change.before)
      throw new Error('Configuration changed during setup; rerun setup.');
  }
  let backup: string | undefined;
  if (pending.some((change) => change.before !== undefined)) {
    backup = await mkdtemp(resolve(tmpdir(), 'repo-workbench-setup-'));
    for (const change of pending)
      if (change.before !== undefined)
        await writeFile(
          resolve(backup, change.file === file ? 'marketplace.json' : 'config.toml'),
          change.before,
          { mode: 0o600, flag: 'wx' },
        );
  }
  for (const change of pending) {
    await mkdir(dirname(change.file), { recursive: true });
    const temporary = change.file + '.' + randomUUID() + '.tmp';
    try {
      const mode = change.before === undefined ? 0o600 : (await lstat(change.file)).mode & 0o777;
      await writeFile(temporary, change.after, { flag: 'wx', mode });
      await writablePath(root, change.file);
      if ((await readOptional(change.file)) !== change.before)
        throw new Error('Configuration changed during setup; rerun setup.');
      await rename(temporary, change.file);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  return {
    scope,
    marketplace: file,
    plugin,
    changed: pending.map((change) => change.file),
    backup,
    register:
      scope === 'user'
        ? { command: 'codex', args: ['plugin', 'marketplace', 'add', root] }
        : undefined,
    enable: scope === 'repo' ? { file: configFile, disabled } : undefined,
    next:
      scope === 'user'
        ? `codex plugin add ${plugin}`
        : 'Project enablement is saved. Open this trusted repository in Codex and refresh plugins or start a fresh chat. Rerun setup after adding another user Workbench installation.',
  };
}
