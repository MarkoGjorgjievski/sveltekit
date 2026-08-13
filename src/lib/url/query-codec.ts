import { ITEM_CHANNELS, ITEM_STATUSES, type ItemChannel, type ItemStatus } from '$lib/schemas/item';
import {
	ItemQuerySchema,
	PER_PAGE_OPTIONS,
	SORT_KEYS,
	type ItemQuery,
	type SortKey
} from '$lib/schemas/query';

export type { ItemQuery, SortKey };

export const DEFAULT_QUERY: ItemQuery = ItemQuerySchema.parse({});

export const QUERY_PARAM = {
	q: 'q',
	status: 'status',
	channel: 'channel',
	tags: 'tag', // singular on the wire — the assignment's own search URL uses ?tag=
	sort: 'sort',
	dir: 'dir',
	page: 'page',
	perPage: 'perPage'
} as const satisfies Record<keyof ItemQuery, string>;

function keepKnown<T extends string>(values: string[], allowed: readonly T[]): T[] {
	return values.filter((value): value is T => (allowed as readonly string[]).includes(value));
}

export function parseQuery(params: URLSearchParams): ItemQuery {
	const sortCandidate = params.get(QUERY_PARAM.sort);
	const dirCandidate = params.get(QUERY_PARAM.dir);
	const pageCandidate = Number(params.get(QUERY_PARAM.page));
	const perPageCandidate = Number(params.get(QUERY_PARAM.perPage));

	const candidate = {
		q: params.get(QUERY_PARAM.q)?.trim() ?? DEFAULT_QUERY.q,
		status: keepKnown<ItemStatus>(params.getAll(QUERY_PARAM.status), ITEM_STATUSES),
		channel: keepKnown<ItemChannel>(params.getAll(QUERY_PARAM.channel), ITEM_CHANNELS),
		tags: params.getAll(QUERY_PARAM.tags).filter((tag) => tag.length > 0),
		sort: (SORT_KEYS as readonly string[]).includes(sortCandidate ?? '')
			? (sortCandidate as SortKey)
			: DEFAULT_QUERY.sort,
		dir: dirCandidate === 'asc' || dirCandidate === 'desc' ? dirCandidate : DEFAULT_QUERY.dir,
		page:
			Number.isInteger(pageCandidate) && pageCandidate >= 1 ? pageCandidate : DEFAULT_QUERY.page,
		perPage: (PER_PAGE_OPTIONS as readonly number[]).includes(perPageCandidate)
			? (perPageCandidate as ItemQuery['perPage'])
			: DEFAULT_QUERY.perPage
	};

	const result = ItemQuerySchema.safeParse(candidate);
	return result.success ? result.data : DEFAULT_QUERY;
}

export function toSearchParams(query: ItemQuery): URLSearchParams {
	const params = new URLSearchParams();
	if (query.q) params.set(QUERY_PARAM.q, query.q);
	for (const status of query.status) params.append(QUERY_PARAM.status, status);
	for (const channel of query.channel) params.append(QUERY_PARAM.channel, channel);
	for (const tag of query.tags) params.append(QUERY_PARAM.tags, tag);
	if (query.sort !== DEFAULT_QUERY.sort) params.set(QUERY_PARAM.sort, query.sort);
	if (query.dir !== DEFAULT_QUERY.dir) params.set(QUERY_PARAM.dir, query.dir);
	if (query.page !== DEFAULT_QUERY.page) params.set(QUERY_PARAM.page, String(query.page));
	if (query.perPage !== DEFAULT_QUERY.perPage)
		params.set(QUERY_PARAM.perPage, String(query.perPage));
	return params;
}
