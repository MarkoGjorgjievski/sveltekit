import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import tags from '$lib/fixtures/tags.json';
import type { Post } from '$lib/schemas/post';
import Page from './+page.svelte';
import type { PageProps } from './$types';

function makePost(overrides: Partial<Post> = {}): Post {
	return {
		id: 'post_test',
		slug: 'test-post',
		translations: {
			en: { title: 'Test Post', excerpt: 'An excerpt.', body: 'Body one.\n\nBody two.' },
			de: { title: 'Testbeitrag', excerpt: 'Ein Auszug.', body: 'Body eins.\n\nBody zwei.' }
		},
		tags: ['testing'],
		author: { id: 'author_test', name: 'Test Author', avatarColor: '#336699' },
		publishedAt: '2026-01-01T00:00:00.000Z',
		readingTimeMinutes: 3,
		coverColor: '#663399',
		...overrides
	};
}

function props(overrides: Partial<PageProps['data']> = {}): PageProps {
	return {
		params: {},
		form: undefined,
		data: {
			locale: 'en',
			theme: 'light',
			q: '',
			tag: null,
			sort: 'relevance',
			tags,
			results: [makePost()],
			...overrides
		}
	};
}

describe('search page', () => {
	it('exposes the query field as a searchbox with an accessible name from its label', async () => {
		const screen = render(Page, props());

		const box = screen.getByRole('searchbox');
		await expect.element(box).toBeInTheDocument();
		await expect.element(box).toHaveAccessibleName('Search posts');
	});

	it('renders every tag as a link carrying its own accessible name', async () => {
		const screen = render(Page, props());

		for (const tag of tags) {
			const link = screen.getByRole('link', { name: tag.label.en });
			await expect.element(link).toBeInTheDocument();
		}
	});

	it('renders the no-results copy, with the tag links still present as a recovery path', async () => {
		const screen = render(Page, props({ q: 'zzzznothing', results: [] }));

		await expect
			.element(screen.getByText('No matches. Try a different query.'))
			.toBeInTheDocument();
		const link = screen.getByRole('link', { name: tags[0].label.en });
		await expect.element(link).toBeInTheDocument();
	});
});
