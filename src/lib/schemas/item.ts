import { z } from 'zod';

export const ITEM_STATUSES = [
	'draft',
	'scheduled',
	'active',
	'paused',
	'completed',
	'archived'
] as const;
export const ITEM_CHANNELS = ['email', 'sms', 'web', 'social', 'push'] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type ItemChannel = (typeof ITEM_CHANNELS)[number];

export const ItemSchema = z.object({
	id: z.string(),
	name: z.string(),
	status: z.enum(ITEM_STATUSES),
	channel: z.enum(ITEM_CHANNELS),
	owner: z.object({ id: z.string(), name: z.string() }),
	budget: z.number().nonnegative(),
	spent: z.number().nonnegative(),
	impressions: z.number().int().nonnegative(),
	clicks: z.number().int().nonnegative(),
	ctr: z.number().min(0).max(1),
	startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	updatedAt: z.iso.datetime(),
	tags: z.array(z.string())
});

export type Item = z.infer<typeof ItemSchema>;
