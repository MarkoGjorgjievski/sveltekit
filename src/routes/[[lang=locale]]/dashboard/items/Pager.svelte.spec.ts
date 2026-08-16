import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { DEFAULT_QUERY } from '$lib/url/query-codec';
import Pager from './Pager.svelte';

function setup(overrides: { page?: number; pageCount?: number; total?: number } = {}) {
	const page = overrides.page ?? 1;
	const pageCount = overrides.pageCount ?? 3;
	const total = overrides.total ?? 25;
	return render(Pager, {
		page,
		pageCount,
		total,
		perPage: 10,
		query: { ...DEFAULT_QUERY, page },
		locale: 'en'
	});
}

describe('Pager', () => {
	it('marks the current page with aria-current="page"', async () => {
		const screen = setup({ page: 2, pageCount: 3 });
		const current = screen.getByRole('link', { name: '2' });
		await expect.element(current).toHaveAttribute('aria-current', 'page');
	});

	it('does not mark other page links as current', async () => {
		const screen = setup({ page: 2, pageCount: 3 });
		const other = screen.getByRole('link', { name: 'Page 1' });
		await expect.element(other).not.toHaveAttribute('aria-current');
	});

	// Disabled edges render as a <span>, not a disabled anchor — a disabled anchor is still
	// focusable and still announced as a link by assistive tech, which would be a tab stop that
	// silently does nothing.
	it('renders the disabled previous edge as a span, not an anchor, on page 1', async () => {
		const screen = setup({ page: 1, pageCount: 3 });
		const previous = screen.getByText('Previous');
		await expect.element(previous).toBeInTheDocument();
		expect(previous.element().tagName).toBe('SPAN');
	});

	it('renders previous as a real link on any page after the first', async () => {
		const screen = setup({ page: 2, pageCount: 3 });
		const previous = screen.getByRole('link', { name: 'Previous' });
		// Page 1 is ItemQuery's default, so toSearchParams omits the `page` param entirely rather
		// than spelling out page=1 — the href's query string is empty.
		await expect.element(previous).toHaveAttribute('href', '/en/dashboard/items?');
	});

	it('renders the disabled next edge as a span, not an anchor, on the last page', async () => {
		const screen = setup({ page: 3, pageCount: 3 });
		const next = screen.getByText('Next');
		await expect.element(next).toBeInTheDocument();
		expect(next.element().tagName).toBe('SPAN');
	});

	it('renders next as a real link with the following page number when not on the last page', async () => {
		const screen = setup({ page: 1, pageCount: 3 });
		const next = screen.getByRole('link', { name: 'Next' });
		await expect.element(next).toHaveAttribute('href', expect.stringContaining('page=2'));
	});

	it('renders the showing summary from the current page and total', async () => {
		const screen = setup({ page: 2, pageCount: 3, total: 25 });
		await expect.element(screen.getByText('Showing 11–20 of 25')).toBeInTheDocument();
	});

	it('omits pagination controls entirely when there is only one page', async () => {
		const screen = setup({ page: 1, pageCount: 1, total: 5 });
		expect(screen.container.querySelector('nav')).toBeNull();
	});
});
