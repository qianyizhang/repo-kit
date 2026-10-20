import type { ReviewDocument, TraceEvent } from './contracts.ts';
export interface TextBlock {
  text: string;
  offset: number;
  nextOffset: number;
  total: number;
}
export interface RecordSource {
  text(
    event: TraceEvent,
    field: 'text' | 'output',
    offset: number,
    signal: AbortSignal,
  ): Promise<TextBlock>;
  image(event: TraceEvent, index: number): string | undefined;
  manifest: string;
}
/** Embedded exports and bounded, byte-pinned local reads implement the same interface. */
export function recordSource(document: ReviewDocument): RecordSource {
  const delivery = document.delivery;
  const url = (event: TraceEvent, endpoint: string) =>
    endpoint +
    '?' +
    new URLSearchParams({
      session: delivery?.session ?? '',
      event: event.key,
      revision: event.body?.sources.map((source) => source.sha256).join('.') ?? '',
    }).toString();
  return {
    manifest: delivery
      ? '/trace-manifest?session=' + encodeURIComponent(delivery.session)
      : 'manifest.json',
    async text(event, field, offset, signal) {
      if (!delivery || !event.body) {
        const value = event[field] ?? '';
        return { text: value, offset: 0, nextOffset: value.length, total: value.length };
      }
      const response = await fetch(
        url(event, '/trace-record') +
          '&' +
          new URLSearchParams({ field, offset: String(offset) }).toString(),
        { signal },
      );
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as TextBlock;
    },
    image(event, index) {
      return delivery && event.body
        ? url(event, '/trace-image') + '&image=' + index
        : event.imageUrls?.[index];
    },
  };
}
