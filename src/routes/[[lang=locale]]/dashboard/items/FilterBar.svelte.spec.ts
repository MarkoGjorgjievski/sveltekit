import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { DEFAULT_QUERY } from '$lib/url/query-codec';
import type { ItemPage } from '$lib/server/data/items.repo';
import FilterBar from './FilterBar.svelte';

// FilterBar's debounced text input cancels its timer via beforeNavigate, and facet pickers
// navigate with goto() — neither should attempt a real client-side navigation with no router
// mounted.
vi.mock('$app/navigation', () => ({ goto: vi.fn(), beforeNavigate: vi.fn() }));

const emptyFacets: ItemPage['facets'] = {
	status: { draft: 0, scheduled: 0, active: 0, paused: 0, completed: 0, archived: 0 },
	channel: { email: 0, sms: 0, web: 0, social: 0, push: 0 },
	tags: {}
};

describe('FilterBar — no-JS state parity', () => {
	it('carries the current sort and dir forward as hidden inputs, and does not carry page', async () => {
		const screen = render(FilterBar, {
			query: { ...DEFAULT_QUERY, sort: 'budget', dir: 'asc', page: 7 },
			facets: emptyFacets,
			locale: 'en'
		});

		const form = screen.container.querySelector('form')!;
		const sortInput = form.querySelector('input[name="sort"]') as HTMLInputElement | null;
		const dirInput = form.querySelector('input[name="dir"]') as HTMLInputElement | null;

		// With JavaScript, sort/dir are preserved because the goto() path spreads
		// {...query, ...patch}. Without it, a plain GET submit only carries what the form itself
		// has controls for — so unless sort/dir are here as hidden inputs, submitting a filter
		// change with JS disabled would silently reset sorting to the server's default.
		expect(sortInput).not.toBeNull();
		expect(sortInput?.type).toBe('hidden');
		expect(sortInput?.value).toBe('budget');

		expect(dirInput).not.toBeNull();
		expect(dirInput?.type).toBe('hidden');
		expect(dirInput?.value).toBe('asc');

		// A filter change resets page to 1 — the form simply never carries a page field, letting
		// parseQuery's own default (1) apply on submit, the same way the JS goto() path forces
		// page: 1 in its patch.
		expect(form.querySelector('[name="page"]')).toBeNull();
	});

	it('reflects a default sort/dir in the hidden inputs too, not just non-default ones', async () => {
		const screen = render(FilterBar, {
			query: DEFAULT_QUERY,
			facets: emptyFacets,
			locale: 'en'
		});

		const form = screen.container.querySelector('form')!;
		const sortInput = form.querySelector('input[name="sort"]') as HTMLInputElement | null;
		const dirInput = form.querySelector('input[name="dir"]') as HTMLInputElement | null;

		expect(sortInput?.value).toBe(DEFAULT_QUERY.sort);
		expect(dirInput?.value).toBe(DEFAULT_QUERY.dir);
	});

	it('renders without crashing while facets is undefined, before the streamed result resolves', async () => {
		const screen = render(FilterBar, {
			query: DEFAULT_QUERY,
			facets: undefined,
			locale: 'en'
		});

		// The bar itself — including the status/channel comboboxes, which have a fixed set of
		// options independent of facets — is fully present immediately.
		await expect.element(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
		await expect.element(screen.getByRole('combobox', { name: 'Tags' })).toBeInTheDocument();
	});
});

describe('FilterBar — active filter summary', () => {
	it('names every active filter across all three facets', async () => {
		// The gap this covers: a shared link filtered the table while every control rendered empty,
		// so the only on-screen account of what was filtering it was the URL.
		const screen = render(FilterBar, {
			query: { ...DEFAULT_QUERY, status: ['active', 'draft'], channel: ['email'], tags: ['q3'] },
			facets: emptyFacets,
			locale: 'en'
		});

		for (const label of ['Active', 'Draft', 'Email', 'q3']) {
			await expect
				.element(screen.getByRole('button', { name: `Remove ${label} filter` }))
				.toBeInTheDocument();
		}
	});

	it('shows nothing when no filter is applied', async () => {
		const screen = render(FilterBar, { query: DEFAULT_QUERY, facets: emptyFacets, locale: 'en' });
		expect(screen.container.querySelectorAll('button[aria-label^="Remove"]')).toHaveLength(0);
	});

	it('removes only the filter whose chip was pressed', async () => {
		const { goto } = await import('$app/navigation');
		const screen = render(FilterBar, {
			query: { ...DEFAULT_QUERY, status: ['active', 'draft'], channel: ['email'] },
			facets: emptyFacets,
			locale: 'en'
		});

		await screen.getByRole('button', { name: 'Remove Draft filter' }).click();

		// The surviving status and the untouched channel must both still be in the target URL —
		// a chip that cleared its whole facet would be worse than no chip at all.
		const target = String(vi.mocked(goto).mock.calls.at(-1)?.[0]);
		expect(target).toContain('status=active');
		expect(target).not.toContain('status=draft');
		expect(target).toContain('channel=email');
	});
});
