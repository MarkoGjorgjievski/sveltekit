import { ITEM_CHANNELS, ITEM_STATUSES, type ItemChannel, type ItemStatus } from '$lib/schemas/item';
import { PER_PAGE_OPTIONS, SORT_KEYS, type ItemQuery, type SortKey } from '$lib/schemas/query';

export type { ItemQuery, SortKey };

export const DEFAULT_QUERY: ItemQuery = {
	q: '',
	status: [],
	channel: [],
	tags: [],
	sort: 'updatedAt',
	dir: 'desc',
	page: 1,
	perPage: 25
};

function keepKnown<T extends string>(values: string[], allowed: readonly T[]): T[] {
	return values.filter((value): value is T => (allowed as readonly string[]).includes(value));
}

export function parseQuery(params: URLSearchParams): ItemQuery {
	const sortCandidate = params.get('sort');
	const dirCandidate = params.get('dir');
	const pageCandidate = Number(params.get('page'));
	const perPageCandidate = Number(params.get('perPage'));

	return {
		q: params.get('q')?.trim() ?? DEFAULT_QUERY.q,
		status: keepKnown<ItemStatus>(params.getAll('status'), ITEM_STATUSES),
		channel: keepKnown<ItemChannel>(params.getAll('channel'), ITEM_CHANNELS),
		tags: params.getAll('tag').filter((tag) => tag.length > 0),
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
}

export function toSearchParams(query: ItemQuery): URLSearchParams {
	const params = new URLSearchParams();
	if (query.q) params.set('q', query.q);
	for (const status of query.status) params.append('status', status);
	for (const channel of query.channel) params.append('channel', channel);
	for (const tag of query.tags) params.append('tag', tag);
	if (query.sort !== DEFAULT_QUERY.sort) params.set('sort', query.sort);
	if (query.dir !== DEFAULT_QUERY.dir) params.set('dir', query.dir);
	if (query.page !== DEFAULT_QUERY.page) params.set('page', String(query.page));
	if (query.perPage !== DEFAULT_QUERY.perPage) params.set('perPage', String(query.perPage));
	return params;
}
