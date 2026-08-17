import { fail } from '@sveltejs/kit';
import { ItemMutationError, queryItems, updateItemStatus } from '$lib/server/data/items.repo';
import { fixtureHealth } from '$lib/server/data/fixtures';
import { can } from '$lib/server/auth/permissions';
import { parseQuery } from '$lib/url/query-codec';
import { ITEM_STATUSES } from '$lib/schemas/item';
import type { ItemPage } from '$lib/server/data/items.repo';
import type { Actions, PageServerLoad } from './$types';
import { localeFromParams } from '$lib/i18n/locale';

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

export const load: PageServerLoad = ({ params, url, locals, depends }) => {
	depends('app:items');
	const query = parseQuery(url.searchParams);

	return {
		query,
		locale: localeFromParams(params.lang, locals.locale),
		canEdit: can(locals.user, 'item:update'),
		result: loadItems(query) // deliberately NOT awaited — this is the streamed part
	};
};

// `handle` already keeps a viewer off this route entirely, but that guard protects *pages* — an
// action is a separate POST entry point (reachable directly, without ever rendering the page it's
// nested under) and must authorize itself rather than trust that the page it lives beside did.
export const actions: Actions = {
	updateStatus: async ({ request, locals }) => {
		if (!can(locals.user, 'item:update')) {
			return fail(403, { reason: 'role' as const });
		}

		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const status = String(form.get('status') ?? '');

		if (!(ITEM_STATUSES as readonly string[]).includes(status)) {
			return fail(400, { reason: 'invalid' as const });
		}

		try {
			return { item: updateItemStatus(id, status as (typeof ITEM_STATUSES)[number]) };
		} catch (error) {
			if (error instanceof ItemMutationError && error.code === 'archived') {
				return fail(409, { reason: 'archived' as const });
			}
			return fail(404, { reason: 'missing' as const });
		}
	}
};
