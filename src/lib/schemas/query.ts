import { z } from 'zod';
import { ITEM_CHANNELS, ITEM_STATUSES } from './item';

export const SORT_KEYS = [
	'name',
	'status',
	'channel',
	'owner',
	'budget',
	'spent',
	'ctr',
	'updatedAt'
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const PER_PAGE_OPTIONS = [10, 25, 50] as const;

export const ItemQuerySchema = z.object({
	q: z.string().default(''),
	status: z.array(z.enum(ITEM_STATUSES)).default([]),
	channel: z.array(z.enum(ITEM_CHANNELS)).default([]),
	tags: z.array(z.string()).default([]),
	sort: z.enum(SORT_KEYS).default('updatedAt'),
	dir: z.enum(['asc', 'desc']).default('desc'),
	page: z.number().int().min(1).default(1),
	perPage: z.union([z.literal(10), z.literal(25), z.literal(50)]).default(25)
});

export type ItemQuery = z.infer<typeof ItemQuerySchema>;
