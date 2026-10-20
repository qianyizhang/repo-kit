import type { Prices } from './model.ts';
// Verified against the linked official model pages on this date. Current rates
// apply to all history; these estimates do not reconstruct historical invoices.
export const priceDate = '2026-10-09';
export const priceSource = 'https://developers.openai.com/api/docs/pricing';
const rate = (input: number, cached: number, output: number, longContext = true) => ({
  input,
  cached,
  write: input * 1.25,
  output,
  longContext,
});
export const officialPrices: Prices = {
  'gpt-6.1-sol': rate(2, 0.1, 10),
  'gpt-6-astra': rate(10, 1, 50),
  'gpt-6-sol': rate(2, 0.2, 10),
  'gpt-6-luna': rate(0.1, 0.01, 0.5),
  'gpt-5.6-sol': rate(4, 0.4, 20),
  'gpt-5.6-terra': rate(2, 0.2, 12),
  'gpt-5.6-luna': rate(0.2, 0.02, 1.2),
  // These older models do not publish a separate cache-write rate. Their traces
  // normally report no writes; any record containing writes remains unpriced.
  'gpt-5.5': {
    input: 5,
    cached: 0.5,
    write: 0,
    writeUnpublished: true,
    output: 30,
    longContext: true,
  },
  'gpt-5.4': {
    input: 2.5,
    cached: 0.25,
    write: 0,
    writeUnpublished: true,
    output: 15,
    longContext: true,
  },
  'gpt-5.4-mini': { input: 0.75, cached: 0.075, write: 0, writeUnpublished: true, output: 4.5 },
  'gpt-5.3-codex': { input: 1.75, cached: 0.175, write: 0, writeUnpublished: true, output: 14 },
};
