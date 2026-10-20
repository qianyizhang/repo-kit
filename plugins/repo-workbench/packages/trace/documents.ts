import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

/** Read a local, immutable Git blob. Missing history fails; never substitute current bytes. */
export function gitDocument(root: string, path: string, revision: string): Buffer {
  const git = (args: string[]) => {
    const result = spawnSync('git', ['--no-pager', '-C', root, ...args], {
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error || result.status !== 0)
      throw new Error(
        `Cannot read pinned document ${revision}:${path}: ${result.stderr?.toString() || String(result.error)}`,
      );
    return result.stdout;
  };
  if (realpathSync(git(['rev-parse', '--show-toplevel']).toString().trim()) !== realpathSync(root))
    throw new Error('Pinned documents require the declared repository root');
  if (git(['cat-file', '-t', revision]).toString().trim() !== 'commit')
    throw new Error('Pinned document revision must identify a commit');
  const entry = git(['ls-tree', revision, '--', path]).toString();
  if (!/^100(?:644|755) blob [0-9a-f]{40}\t/.test(entry))
    throw new Error('Pinned document must be a regular Git blob');
  return git(['cat-file', 'blob', `${revision}:${path}`]);
}
