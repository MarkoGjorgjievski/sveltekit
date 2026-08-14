import { queryItems } from '$lib/server/data/items.repo';
import { fixtureHealth } from '$lib/server/data/fixtures';
import { can } from '$lib/server/auth/permissions';
import { parseQuery } from '$lib/url/query-codec';
import type { ItemPage } from '$lib/server/data/items.repo';
import type { PageServerLoad } from './$types';

export const config = { runtime: 'nodejs22.x' };
export const prerender = false;

export type ItemsResult =
	{ ok: true; page: ItemPage; health: { dropped: number } } | { ok: false; reason: 'load_failed' };

async function loadItems(query: ReturnType<typeof parseQuery>): Promise<ItemsResult> {
	try {
		// Simulated backend latency, so the streamed skeleton is observable
		// rather than theoretical. Remove when a real API replaces the fixture.
		await new Promise((resolve) => setTimeout(resolve, 250));
		return { ok: true, page: queryItems(query), health: { dropped: fixtureHealth.dropped } };
	} catch {
		return { ok: false, reason: 'load_failed' };
	}
}

export const load: PageServerLoad = ({ url, locals, depends }) => {
	depends('app:items');
	const query = parseQuery(url.searchParams);

	return {
		query,
		locale: locals.locale,
		canEdit: can(locals.user, 'item:update'),
		result: loadItems(query) // deliberately NOT awaited — this is the streamed part
	};
};
