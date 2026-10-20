import { gzipSync } from 'node:zlib';
import { asset } from '../runtime/assets.ts';
import type { ReviewDocument } from './src/model/contracts.ts';
let bundle: Promise<{ js: string; css: string }> | undefined;
/** Prebuilt assets serve offline exports without build tools or network access. */
export async function renderReview(document: ReviewDocument): Promise<string> {
  bundle ??= Promise.all([asset('review.js'), asset('review.css')]).then(([js, css]) => ({
    js,
    css,
  }));
  const { js, css } = await bundle;
  const data = gzipSync(JSON.stringify(document)).toString('base64');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Session review</title><style>${css}</style></head><body><div id="root"></div><script id="trace-data" type="application/octet-stream">${data}</script><script type="module">${js}</script></body></html>`;
}
