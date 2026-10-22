import { open, type FileHandle } from 'node:fs/promises';
import { createZstdDecompress } from 'node:zlib';
import type { Readable } from 'node:stream';

export const compressedLog = (path: string) => path.endsWith('.jsonl.zst');
export const supportedLog = (path: string) => path.endsWith('.jsonl') || compressedLog(path);

/** Offsets and hashes always refer to decoded JSONL bytes, including archived logs. */
export function logStream(handle: FileHandle, path: string, start: number, end: number): Readable {
  if (compressedLog(path) && start !== 0) throw new Error('Compressed logs require a full read');
  const raw = handle.createReadStream({ start, end, autoClose: false });
  if (!compressedLog(path)) return raw;
  const decoded = createZstdDecompress();
  raw.on('error', (error) => decoded.destroy(error));
  decoded.once('close', () => {
    if (!raw.readableEnded) raw.destroy();
  });
  return raw.pipe(decoded);
}

export async function readLogRanges(path: string, ranges: { offset: number; bytes: number }[]) {
  const handle = await open(path, 'r');
  const buffers = ranges.map((range) => Buffer.alloc(range.bytes));
  const counts = ranges.map(() => 0);
  let stream: Readable | undefined;
  try {
    if (compressedLog(path)) {
      const info = await handle.stat();
      if (info.size) {
        stream = logStream(handle, path, 0, info.size - 1);
        let position = 0;
        for await (const raw of stream) {
          const chunk = raw as Buffer;
          ranges.forEach((range, i) => {
            const start = Math.max(position, range.offset);
            const end = Math.min(position + chunk.length, range.offset + range.bytes);
            if (end > start) {
              chunk.copy(buffers[i], start - range.offset, start - position, end - position);
              counts[i] += end - start;
            }
          });
          position += chunk.length;
          // Consume the frame to validate its trailer; a corrupt archive is never accepted.
        }
      }
    } else {
      for (const [i, range] of ranges.entries()) {
        while (counts[i] < range.bytes) {
          const { bytesRead } = await handle.read(
            buffers[i],
            counts[i],
            range.bytes - counts[i],
            range.offset + counts[i],
          );
          if (!bytesRead) break;
          counts[i] += bytesRead;
        }
      }
    }
    if (ranges.some((range, i) => range.bytes !== counts[i]))
      throw new Error('Source record changed. Reopen the trace.');
    return buffers;
  } finally {
    stream?.destroy();
    await handle.close();
  }
}
