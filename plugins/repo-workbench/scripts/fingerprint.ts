import { sharedFingerprint } from '../../mcp-app-runtime/src/release.ts';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Hash authored build inputs, including dependency resolutions, configs and static assets. */
export async function buildFingerprint(root: string): Promise<string> {
  async function files(directory: string): Promise<string[]> {
    const entries = await readdir(join(root, directory), { withFileTypes: true });
    return (
      await Promise.all(
        entries.map(async (entry) => {
          const path = join(directory, entry.name);
          return entry.isDirectory()
            ? files(path)
            : /\.(?:test|spec)\.tsx?$/.test(path)
              ? []
              : [path];
        }),
      )
    ).flat();
  }
  const paths = [
    ...(await files('packages')),
    ...(await files('scripts')),
    'package.json',
    'package-lock.json',
    'plugin.json',
    'mcp.json',
    'tsconfig.json',
  ];
  const hash = createHash('sha256').update(await sharedFingerprint());
  for (const path of paths.sort()) {
    hash.update(path);
    hash.update('\0');
    hash.update(await readFile(join(root, path)));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}
