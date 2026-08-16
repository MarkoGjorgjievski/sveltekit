import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from '@vitest/browser/context';
import { DEFAULT_QUERY } from '$lib/url/query-codec';
import type { Item } from '$lib/schemas/item';
import type { ItemPage } from '$lib/server/data/items.repo';
import Page from './+page.svelte';
import type { PageProps } from './$types';
import type { ItemsResult } from './+page.server';
import { reservedResultsHeightPx } from './table-metrics';

// $app/navigation is mocked so ErrorRegion's retry button can call invalidate(), and FilterBar's
// debounced input can call goto()/beforeNavigate(), without SvelteKit attempting a real
// client-side navigation with no router mounted. invalidateAll is stubbed too, not because
// anything here calls it (StatusCell deliberately never does — see optimistic.svelte.ts), but
// because $app/forms's `enhance` imports it internally, and a full module mock without it throws
// a missing-export error the moment `use:enhance` is evaluated.
vi.mock('$app/navigation', () => ({
	invalidate: vi.fn(),
	invalidateAll: vi.fn(),
	goto: vi.fn(),
	beforeNavigate: vi.fn()
}));

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
		form: null,
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

	// FilterBar is built entirely from `data.query`, which resolves synchronously with the page
	// shell, so it must never wait on the streamed promise — that dependency is exactly what used
	// to make the results region grow by the filter bar's full height on every single load.
	it('renders the filter bar immediately, before the streamed result resolves', async () => {
		const neverResolves = new Promise<ItemsResult>(() => {});
		const screen = render(Page, props(neverResolves));

		await expect.element(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
		// The results region (skeleton, then table) is a distinct sibling from the filter bar, so
		// the filter bar sits outside its min-height reservation entirely.
		const filterForm = screen.container.querySelector('form');
		const region = screen.container.querySelector('[data-testid="items-results-region"]');
		expect(filterForm).not.toBeNull();
		expect(region?.contains(filterForm)).toBe(false);
	});

	it("reserves the skeleton's full height on the results region, even for a short resolved state", async () => {
		// perPage is chosen distinct from any other default used in this file so this assertion
		// can't coincidentally pass against a hardcoded number — it must go through the real
		// stubbed query.
		const perPage = 10;
		const result: ItemsResult = {
			ok: true,
			page: makePage({ rows: [], total: 0, pageCount: 0 }),
			health: { dropped: 0 }
		};
		const screen = render(
			Page,
			props(Promise.resolve(result), { query: { ...DEFAULT_QUERY, perPage } })
		);

		// Wait for the short (empty) resolved state to actually render before measuring — if the
		// reservation were missing, this is exactly the moment the container would collapse.
		await expect.element(screen.getByText('No campaigns yet.')).toBeInTheDocument();

		const region = screen.container.querySelector<HTMLElement>(
			'[data-testid="items-results-region"]'
		);
		expect(region).not.toBeNull();
		expect(getComputedStyle(region!).minHeight).toBe(`${reservedResultsHeightPx(perPage)}px`);
	});

	// FilterBar renders above the streamed region, built from `data.query` alone — it no longer
	// lives inside ItemsTable, so this is the one place FilterBar, the sort headers, and the pager
	// are ever assembled together the way a real user actually encounters them. A tab walk scoped
	// to any single component would skip the other two.
	it('reaches every sort header, every facet combobox, each row status select, the pager links, and the clear-filters link by Tab alone', async () => {
		const rows = [
			makeItem({ id: 'item_1', name: 'Spring campaign' }),
			makeItem({ id: 'item_2', name: 'Autumn campaign' })
		];
		const result: ItemsResult = {
			ok: true,
			page: makePage({ rows, total: 15, page: 1, pageCount: 2 }),
			health: { dropped: 0 }
		};
		const screen = render(
			Page,
			// An active filter, so FilterBar's own clear-filters link renders too.
			props(Promise.resolve(result), { query: { ...DEFAULT_QUERY, status: ['active'] } })
		);
		await expect.element(screen.getByRole('link', { name: 'Name' })).toBeInTheDocument();

		const expectFocus = async (locator: ReturnType<typeof screen.getByRole>) => {
			await userEvent.tab();
			await expect.element(locator).toHaveFocus();
		};

		// The browser tab under test starts with nothing focused, and a bare Tab press from that
		// state doesn't reliably enter the page in this harness — so focus is seeded with a real
		// click on the first control, same as a keyboard user landing here via Shift+Tab from the
		// browser chrome would. Every control after this one is reached by Tab alone.
		const searchInput = screen.getByLabelText('Search');
		await searchInput.click();
		await expect.element(searchInput).toHaveFocus();

		// FilterBar: three comboboxes, perPage select, submit, clear-filters link. `exact: true` on
		// the Status combobox specifically, because Playwright's role-name matching is substring
		// and case-insensitive by default — without it, "Status" also matches every row's "Change
		// status for {name}" select below, which is itself the point of that per-row name.
		await expectFocus(screen.getByRole('combobox', { name: 'Status', exact: true }));
		await expectFocus(screen.getByRole('combobox', { name: 'Channel' }));
		await expectFocus(screen.getByRole('combobox', { name: 'Tags' }));
		await expectFocus(screen.getByLabelText('Rows per page'));
		await expectFocus(screen.getByRole('button', { name: 'Apply filters' }));
		await expectFocus(screen.getByRole('link', { name: 'Clear filters' }));

		// Every sort header, in column order.
		for (const name of [
			'Name',
			'Status',
			'Channel',
			'Owner',
			'Budget',
			'Spent',
			'CTR',
			'Updated'
		]) {
			await expectFocus(screen.getByRole('link', { name }));
		}

		// Each row's status select, in row order — its accessible name comes from the sr-only
		// label built with the item's own name, which is also what proves the two rows' selects are
		// individually addressable rather than announcing identically.
		await expectFocus(screen.getByRole('combobox', { name: 'Change status for Spring campaign' }));
		await expectFocus(screen.getByRole('combobox', { name: 'Change status for Autumn campaign' }));

		// Pager: the disabled "Previous" span on page 1 is not a tab stop at all, so the next stop
		// after the last row's status select is the current-page link, then the next page, then
		// "Next".
		await expectFocus(screen.getByRole('link', { name: '1' }));
		await expectFocus(screen.getByRole('link', { name: 'Page 2' }));
		await expectFocus(screen.getByRole('link', { name: 'Next' }));
	});
});
