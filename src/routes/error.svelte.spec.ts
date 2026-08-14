import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { t } from '$lib/i18n/t';
import ErrorPage from './+error.svelte';

// $app/state's `page` is only meaningfully populated inside a real SvelteKit request/navigation;
// outside that (as here, mounting the component directly) it needs a stand-in. The mock is a
// plain mutable object rather than a Svelte store: +error.svelte reads page.status/page.error/
// page.url once per mount, so each test just needs the right values in place before render(),
// not live reactivity across renders.
const pageState = vi.hoisted(() => ({
	status: 200,
	error: null as { message: string } | null,
	url: new URL('http://localhost:5173/en/nonexistent')
}));

vi.mock('$app/state', () => ({ page: pageState }));

function setPage(status: number, error: { message: string } | null, pathname: string): void {
	pageState.status = status;
	pageState.error = error;
	pageState.url = new URL(`http://localhost:5173${pathname}`);
}

describe('+error.svelte', () => {
	it('renders the 404 copy for a 404 status', async () => {
		setPage(404, { message: 'Not Found' }, '/en/nonexistent');
		const screen = render(ErrorPage);

		await expect
			.element(screen.getByRole('heading', { level: 1 }))
			.toHaveTextContent(t('en', 'error.404.title'));
		await expect.element(screen.getByText(t('en', 'error.404.body'))).toBeInTheDocument();
	});

	it('renders the generic copy for a non-404 status', async () => {
		setPage(500, { message: 'Internal Error' }, '/en/nonexistent');
		const screen = render(ErrorPage);

		await expect
			.element(screen.getByRole('heading', { level: 1 }))
			.toHaveTextContent(t('en', 'error.generic.title'));
		await expect.element(screen.getByText(t('en', 'error.404.body'))).not.toBeInTheDocument();
	});

	it('renders a link back to the blog', async () => {
		setPage(404, { message: 'Not Found' }, '/en/nonexistent');
		const screen = render(ErrorPage);

		const link = screen.getByRole('link', { name: t('en', 'nav.blog') });
		await expect.element(link).toBeInTheDocument();
		expect(link.element().getAttribute('href')).toBe('/en/blog');
	});

	it('renders the German 404 copy when the URL is locale-prefixed with de', async () => {
		setPage(404, { message: 'Not Found' }, '/de/nonexistent');
		const screen = render(ErrorPage);

		await expect
			.element(screen.getByRole('heading', { level: 1 }))
			.toHaveTextContent(t('de', 'error.404.title'));
	});

	it('falls back to English when the URL carries no recognisable locale segment', async () => {
		setPage(404, { message: 'Not Found' }, '/');
		const screen = render(ErrorPage);

		await expect
			.element(screen.getByRole('heading', { level: 1 }))
			.toHaveTextContent(t('en', 'error.404.title'));
	});
});
