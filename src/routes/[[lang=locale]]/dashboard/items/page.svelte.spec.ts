import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { DEFAULT_QUERY } from '$lib/url/query-codec';
import type { Item } from '$lib/schemas/item';
import type { ItemPage } from '$lib/server/data/items.repo';
import Page from './+page.svelte';
import type { PageProps } from './$types';
import type { ItemsResult } from './+page.server';

// $app/navigation is mocked so ErrorRegion's retry button can call invalidate() without
// SvelteKit attempting a real client-side navigation with no router mounted.
vi.mock('$app/navigation', () => ({ invalidate: vi.fn() }));

function makeItem(overrides: Partial<Item> = {}): Item {
	return {
		id: 'item_1',
		name: 'Spring campaign',
		status: 'active',
		channel: 'email',
		owner: { id: 'owner_1', name: 'Owner One' },
		budget: 1000,
		spent: 250,
		impressions: 10000,
		clicks: 100,
		ctr: 0.01,
		startDate: '2026-01-01',
		endDate: '2026-02-01',
		updatedAt: '2026-01-15T00:00:00.000Z',
		tags: [],
		...overrides
	};
}

const emptyFacets: ItemPage['facets'] = {
	status: { draft: 0, scheduled: 0, active: 0, paused: 0, completed: 0, archived: 0 },
	channel: { email: 0, sms: 0, web: 0, social: 0, push: 0 },
	tags: {}
};

function makePage(overrides: Partial<ItemPage> = {}): ItemPage {
	return {
		rows: [makeItem()],
		total: 1,
		page: 1,
		pageCount: 1,
		facets: emptyFacets,
		...overrides
	};
}

function props(
	result: Promise<ItemsResult>,
	overrides: Partial<PageProps['data']> = {}
): PageProps {
	return {
		params: {},
		form: undefined,
		data: {
			// theme and user come from the root and dashboard layouts respectively; this route's
			// own load doesn't touch them, but PageData still merges them in from the parent chain.
			theme: 'light',
			user: { id: 'u_1', email: 'editor@demo.test', name: 'Editor', role: 'editor' },
			query: DEFAULT_QUERY,
			locale: 'en',
			canEdit: true,
			result,
			...overrides
		}
	};
}

describe('dashboard/items page', () => {
	it('renders the empty-state copy and no table rows when the resolved page has zero rows', async () => {
		const result: ItemsResult = {
			ok: true,
			page: makePage({ rows: [], total: 0, pageCount: 0 }),
			health: { dropped: 0 }
		};
		const screen = render(Page, props(Promise.resolve(result)));

		await expect.element(screen.getByText('No campaigns yet.')).toBeInTheDocument();
		expect(screen.container.querySelectorAll('tbody tr')).toHaveLength(0);
	});

	it('renders the partial-data banner with the dropped count interpolated, and still renders the table', async () => {
		const result: ItemsResult = {
			ok: true,
			page: makePage(),
			health: { dropped: 3 }
		};
		const screen = render(Page, props(Promise.resolve(result)));

		await expect.element(screen.getByText('3 records could not be loaded.')).toBeInTheDocument();
		// The point of the partial-failure design is that the table survives alongside the banner.
		expect(screen.container.querySelectorAll('tbody tr')).toHaveLength(1);
	});

	it('renders ErrorRegion and not the table when the result is a load failure', async () => {
		const result: ItemsResult = { ok: false, reason: 'load_failed' };
		const screen = render(Page, props(Promise.resolve(result)));

		await expect.element(screen.getByRole('alert')).toBeInTheDocument();
		expect(screen.container.querySelector('table')).toBeNull();
	});

	it('shows the skeleton and announces loading while the result promise is pending', async () => {
		const neverResolves = new Promise<ItemsResult>(() => {});
		const screen = render(Page, props(neverResolves));

		await expect.element(screen.getByText('Loading…')).toBeInTheDocument();
		const skeletonTable = screen.container.querySelector('table[aria-hidden="true"]');
		expect(skeletonTable).not.toBeNull();
	});
});
