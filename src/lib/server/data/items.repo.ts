import {
	ITEM_CHANNELS,
	ITEM_STATUSES,
	type Item,
	type ItemChannel,
	type ItemStatus
} from '$lib/schemas/item';
import type { ItemQuery, SortKey } from '$lib/schemas/query';
import { items } from './fixtures';

export interface FacetCounts {
	status: Record<ItemStatus, number>;
	channel: Record<ItemChannel, number>;
	tags: Record<string, number>;
}

export interface ItemPage {
	rows: Item[];
	total: number;
	page: number;
	pageCount: number;
	facets: FacetCounts;
}

export class ItemMutationError extends Error {
	constructor(readonly code: 'not_found' | 'archived') {
		super(code);
		this.name = 'ItemMutationError';
	}
}

const store = new Map(items.map((item) => [item.id, item]));

const sortValue: Record<SortKey, (item: Item) => string | number> = {
	name: (item) => item.name,
	status: (item) => ITEM_STATUSES.indexOf(item.status),
	channel: (item) => item.channel,
	owner: (item) => item.owner.name,
	budget: (item) => item.budget,
	spent: (item) => item.spent,
	ctr: (item) => item.ctr,
	updatedAt: (item) => item.updatedAt
};

function matches(item: Item, query: ItemQuery): boolean {
	if (query.q && !item.name.toLowerCase().includes(query.q.toLowerCase())) return false;
	if (query.status.length > 0 && !query.status.includes(item.status)) return false;
	if (query.channel.length > 0 && !query.channel.includes(item.channel)) return false;
	if (query.tags.length > 0 && !query.tags.some((tag) => item.tags.includes(tag))) return false;
	return true;
}

function countStatus(rows: Item[]): Record<ItemStatus, number> {
	const counts = Object.fromEntries(ITEM_STATUSES.map((key) => [key, 0])) as Record<
		ItemStatus,
		number
	>;
	for (const row of rows) counts[row.status] += 1;
	return counts;
}

function countChannel(rows: Item[]): Record<ItemChannel, number> {
	const counts = Object.fromEntries(ITEM_CHANNELS.map((key) => [key, 0])) as Record<
		ItemChannel,
		number
	>;
	for (const row of rows) counts[row.channel] += 1;
	return counts;
}

function countTags(rows: Item[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const row of rows) {
		for (const tag of row.tags) counts[tag] = (counts[tag] ?? 0) + 1;
	}
	return counts;
}

/**
 * Each facet dimension is counted from rows matching every *other* active
 * filter, but not its own. That way a chip's count equals what selecting it
 * would actually deliver (cross-facet numbers are true), while a facet still
 * shows every value you could widen to (its own selection doesn't shrink it).
 */
function computeFacets(all: Item[], query: ItemQuery): FacetCounts {
	return {
		status: countStatus(all.filter((item) => matches(item, { ...query, status: [] }))),
		channel: countChannel(all.filter((item) => matches(item, { ...query, channel: [] }))),
		tags: countTags(all.filter((item) => matches(item, { ...query, tags: [] })))
	};
}

export function queryItems(query: ItemQuery): ItemPage {
	const all = [...store.values()];
	const filtered = all.filter((item) => matches(item, query));

	const read = sortValue[query.sort];
	const direction = query.dir === 'asc' ? 1 : -1;
	filtered.sort((a, b) => {
		const left = read(a);
		const right = read(b);
		if (typeof left === 'string' && typeof right === 'string') {
			return left.localeCompare(right, 'en') * direction;
		}
		return (Number(left) - Number(right)) * direction;
	});

	const total = filtered.length;
	const pageCount = Math.max(1, Math.ceil(total / query.perPage));
	const page = Math.min(Math.max(query.page, 1), pageCount);
	const start = (page - 1) * query.perPage;

	return {
		rows: filtered.slice(start, start + query.perPage),
		total,
		page,
		pageCount,
		facets: computeFacets(all, query)
	};
}

export function updateItemStatus(id: string, status: ItemStatus): Item {
	const existing = store.get(id);
	if (!existing) throw new ItemMutationError('not_found');
	if (existing.status === 'archived') throw new ItemMutationError('archived');

	const updated: Item = { ...existing, status, updatedAt: new Date().toISOString() };
	store.set(id, updated);
	return updated;
}
