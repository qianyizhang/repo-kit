import { homedir } from 'node:os';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, rename, writeFile, realpath } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
declare const WORKBENCH_BUNDLED: boolean;
const packageRoot = fileURLToPath(
  new URL(typeof WORKBENCH_BUNDLED !== 'undefined' ? '../' : '../../', import.meta.url),
);
/** Add one marketplace entry; preserve unrelated entries and never change repository data. */
export async function setup(args: string[], installedRoot = packageRoot) {
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
  const root = await realpath(scope === 'user' ? homedir() : repo);
  const source = await realpath(installedRoot),
    path = relative(root, source);
  if (!path || isAbsolute(path) || path === '..' || path.startsWith('..' + sep))
    throw new Error(`Install the npm package inside ${root} first, then run its setup command.`);
  const file = resolve(root, '.agents/plugins/marketplace.json');
  let catalog: { name: string; plugins: Array<Record<string, unknown>>; [key: string]: unknown } = {
    name:
      scope === 'user'
        ? 'repo-kit'
        : `repo-kit-${createHash('sha256').update(root).digest('hex').slice(0, 12)}`,
    plugins: [],
  };
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
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
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT')
      throw error;
  }
  const entry = {
    name: 'repo-workbench',
    source: { source: 'local', path: './' + path.split(sep).join('/') },
    policy: { installation: 'AVAILABLE', authentication: 'ON_USE' },
    category: 'Developer Tools',
  };
  const prior = catalog.plugins.findIndex((plugin) => plugin?.name === 'repo-workbench');
  if (prior < 0) catalog.plugins.push(entry);
  else catalog.plugins[prior] = { ...catalog.plugins[prior], ...entry };
  await mkdir(dirname(file), { recursive: true });
  const temporary = file + '.' + randomUUID() + '.tmp';
  await writeFile(temporary, JSON.stringify(catalog, null, 2) + '\n', { flag: 'wx' });
  await rename(temporary, file);
  const plugin = `repo-workbench@${catalog.name}`;
  return {
    scope,
    marketplace: file,
    plugin,
    register:
      scope === 'user'
        ? { command: 'codex', args: ['plugin', 'marketplace', 'add', root] }
        : undefined,
    enable:
      scope === 'repo'
        ? {
            file: resolve(root, '.codex/config.toml'),
            toml: `[plugins.${JSON.stringify(plugin)}]\nenabled = true\n`,
          }
        : undefined,
    next:
      scope === 'user'
        ? `codex plugin add ${plugin}`
        : 'Merge the enable.toml snippet into enable.file, preserving existing configuration. Open this trusted repository in Codex and refresh plugins or start a fresh chat.',
  };
}
