import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import type { PageProps } from './$types';

function props(locale: PageProps['data']['locale']): PageProps {
	return { params: {}, form: undefined, data: { locale, theme: 'light' } };
}

describe('landing page', () => {
	it('renders exactly one h1 carrying the localised hero title', async () => {
		const screen = render(Page, props('en'));
		expect(screen.container.querySelectorAll('h1')).toHaveLength(1);
		await expect
			.element(screen.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Build a faster web, without the fight.');
	});

	it('renders the hero CTA as a link into the locale-prefixed blog', async () => {
		const screen = render(Page, props('en'));
		const link = screen.getByRole('link', { name: 'Get started' });
		await expect.element(link).toBeInTheDocument();
		const href = link.element().getAttribute('href');
		expect(href).not.toBeNull();
		expect(href?.startsWith('/en')).toBe(true);
	});

	it('renders the German hero title for locale de, not the English one', async () => {
		const screen = render(Page, props('de'));
		await expect
			.element(screen.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Baue ein schnelleres Web, ohne Kampf.');
	});
});
