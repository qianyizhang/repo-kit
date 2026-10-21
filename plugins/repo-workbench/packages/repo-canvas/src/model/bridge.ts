import type { z } from 'zod';
import type { exchangeSchema } from './contracts';
export type CanvasExchange = z.output<typeof exchangeSchema>;
