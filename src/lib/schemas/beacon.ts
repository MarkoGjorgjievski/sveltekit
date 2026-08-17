import { z } from 'zod';

export const VITAL_NAMES = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'] as const;
export const RATINGS = ['good', 'needs-improvement', 'poor'] as const;

// Every string is bounded. The endpoint logs what it accepts, and an unbounded field on a public
// endpoint is a way to write arbitrarily large lines into someone else's log bill.
export const BeaconSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('vital'),
		name: z.enum(VITAL_NAMES),
		// Rejects NaN and Infinity, which JSON.parse will happily produce from a hand-rolled body,
		// and negative durations, which no real metric emits.
		value: z.number().finite().nonnegative(),
		rating: z.enum(RATINGS),
		path: z.string().max(2048),
		sessionId: z.string().max(100)
	}),
	z.object({
		kind: z.literal('error'),
		message: z.string().max(500),
		stack: z.string().max(4000).optional(),
		path: z.string().max(2048),
		sessionId: z.string().max(100)
	})
]);

export type Beacon = z.infer<typeof BeaconSchema>;
