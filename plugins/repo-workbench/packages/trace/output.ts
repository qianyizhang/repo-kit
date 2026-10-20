import { lstat, mkdir, rm } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

/** Only create a new bundle below the declared root. Existing output is never overwritten. */
export async function freshOutput<T>(
  root: string,
  output: string,
  input: string,
  build: () => Promise<T>,
) {
  const path = relative(root, output);
  if (!path || path === '..' || path.startsWith(`..${sep}`) || resolve(root, path) !== output)
    throw new Error('Output must stay inside repository and cannot be its root');
  if (input === output || input.startsWith(output + sep) || output.startsWith(input + sep))
    throw new Error('Trace input and output directories must not overlap');
  let parent = root;
  const parts = path.split(sep);
  for (const part of parts.slice(0, -1)) {
    parent = resolve(parent, part);
    await mkdir(parent).catch((error: unknown) => {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST')
        throw error;
    });
    const stat = await lstat(parent);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error('Output parents must be real directories');
  }
  await mkdir(output).catch((error: unknown) => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')
      throw new Error('Output already exists; choose a fresh directory to preserve prior evidence');
    throw error;
  });
  try {
    return await build();
  } catch (error) {
    // This directory was created exclusively by this call, never an existing evidence set.
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}
