import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { DEFAULT_QUERY } from '$lib/url/query-codec';
import type { Item } from '$lib/schemas/item';
import type { ItemPage } from '$lib/server/data/items.repo';
import type { ItemQuery } from '$lib/url/query-codec';
import ItemsTable from './ItemsTable.svelte';

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

function setup(query: Partial<ItemQuery> = {}, page: Partial<ItemPage> = {}) {
	return render(ItemsTable, {
		page: makePage(page),
		query: { ...DEFAULT_QUERY, ...query },
		locale: 'en',
		canEdit: true
	});
}

describe('ItemsTable — sortable headers', () => {
	it('renders each header as a link whose href encodes the column to sort by and the starting direction', async () => {
		const screen = setup({ sort: 'updatedAt', dir: 'desc' });
		const link = screen.getByRole('link', { name: 'Name' });
		// A column that isn't currently sorted always starts ascending — the given href is the
		// exact URL a click would produce.
		await expect.element(link).toHaveAttribute('href', expect.stringContaining('sort=name'));
		await expect.element(link).toHaveAttribute('href', expect.stringContaining('dir=asc'));
	});

	// vitest-browser-svelte mounts each render into the same shared page, so these are two
	// separate tests rather than two renders in one — a second render() without unmounting the
	// first would leave both "Budget" header links in the document at once.
	it('flips a currently-ascending column to request descending, omitting the default dir', async () => {
		const ascending = setup({ sort: 'budget', dir: 'asc' });
		const ascLink = ascending.getByRole('link', { name: 'Budget' });
		// Currently ascending -> clicking it again would request descending. `desc` is
		// ItemQuery's default direction, so toSearchParams omits it from the URL entirely rather
		// than spelling out `dir=desc` — the href simply carries no `dir` param.
		await expect.element(ascLink).toHaveAttribute('href', '/en/dashboard/items?sort=budget');
	});

	it('flips a currently-descending column to request ascending, spelling out the non-default dir', async () => {
		const descending = setup({ sort: 'budget', dir: 'desc' });
		const descLink = descending.getByRole('link', { name: 'Budget' });
		// Currently descending -> clicking it again would request ascending, which is not the
		// default, so this one does spell itself out in full.
		await expect
			.element(descLink)
			.toHaveAttribute('href', '/en/dashboard/items?sort=budget&dir=asc');
	});

	it('marks the active column ascending or descending, and every other column none', async () => {
		const screen = setup({ sort: 'budget', dir: 'asc' });
		const activeHeader = screen.container.querySelector(
			'th[aria-sort]:has(a[href*="sort=budget"])'
		);
		expect(activeHeader).not.toBeNull();

		const headers = [...screen.container.querySelectorAll('thead th')];
		const active = headers.find((th) => th.textContent?.includes('Budget'));
		const inactive = headers.find((th) => th.textContent?.includes('Name'));

		expect(active?.getAttribute('aria-sort')).toBe('ascending');
		expect(inactive?.getAttribute('aria-sort')).toBe('none');
	});

	it('reports descending via aria-sort when the active column is sorted descending', async () => {
		const screen = setup({ sort: 'budget', dir: 'desc' });
		const headers = [...screen.container.querySelectorAll('thead th')];
		const active = headers.find((th) => th.textContent?.includes('Budget'));
		expect(active?.getAttribute('aria-sort')).toBe('descending');
	});

	it('resets page to 1 in the generated href, even when the current page is deep in the list', async () => {
		const screen = setup({ sort: 'updatedAt', dir: 'desc', page: 7 });
		const link = screen.getByRole('link', { name: 'Owner' });
		const href = link.element().getAttribute('href') ?? '';
		// toSearchParams omits `page` entirely when it equals the default (1), so a correctly
		// reset href either omits the param or spells it out as page=1 — never page=7.
		const hasNoPageParam = !href.includes('page=');
		const hasPageOne = href.includes('page=1') && !href.includes('page=7');
		expect(hasNoPageParam || hasPageOne).toBe(true);
	});
});

describe('ItemsTable — empty state', () => {
	it('renders the empty message with a clear-filters link when total is 0 and a filter is active', async () => {
		const screen = setup({ tags: ['nonexistent'] }, { rows: [], total: 0, pageCount: 0 });
		await expect.element(screen.getByText('No campaigns yet.')).toBeInTheDocument();

		// Scoped to the empty-state region specifically, even though ItemsTable itself no longer
		// renders FilterBar (and its own persistent "Clear filters" link) alongside it — this keeps
		// the assertion tied to the actual empty-state markup rather than "whichever link matched".
		const emptyState = screen.container.querySelector('[data-testid="items-empty-state"]');
		expect(emptyState).not.toBeNull();
		const clear = emptyState?.querySelector('a');
		expect(clear).not.toBeNull();
		expect(clear?.textContent?.trim()).toBe('Clear filters');
		// The bare pathname — no query string at all — is what actually clears every filter.
		expect(clear?.getAttribute('href')?.includes('?')).toBe(false);
	});

	it('renders no table when total is 0', async () => {
		const screen = setup({}, { rows: [], total: 0, pageCount: 0 });
		expect(screen.container.querySelector('table')).toBeNull();
	});
});

// The full sort-header -> pager keyboard walk now lives in page.svelte.spec.ts, where FilterBar,
// ItemsTable, and Pager are assembled together the way a real user actually encounters them —
// ItemsTable alone no longer renders FilterBar, so a tab walk scoped to this component in
// isolation would skip the filter bar entirely and prove less than it used to.
describe('ItemsTable — keyboard parity', () => {
	it('has no interactive element with a negative tabindex anywhere in the rendered table', async () => {
		const rows = [makeItem()];
		const screen = setup({}, { rows, total: 15, page: 1, pageCount: 2 });

		const interactive = screen.container.querySelectorAll('a, button, input, select');
		expect(interactive.length).toBeGreaterThan(0);
		for (const element of interactive) {
			expect(element.getAttribute('tabindex')).not.toBe('-1');
		}
	});
});
