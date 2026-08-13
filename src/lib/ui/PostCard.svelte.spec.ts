import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PostCard from './PostCard.svelte';
import type { Post } from '$lib/schemas/post';

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

describe('PostCard', () => {
	it('renders its root as an article containing an h2 wrapped by the post link', async () => {
		const post = makePost();
		const screen = render(PostCard, { post, locale: 'en' });

		expect(screen.container.firstElementChild?.tagName).toBe('ARTICLE');

		const heading = screen.getByRole('heading', { level: 2 });
		await expect.element(heading).toHaveTextContent('Test Post');

		const link = screen.getByRole('link', { name: 'Test Post' });
		await expect.element(link).toBeInTheDocument();
		expect(link.element().contains(heading.element())).toBe(true);
	});

	it('links to the locale-prefixed post URL for the given slug', async () => {
		const post = makePost({ slug: 'accessible-combobox-from-scratch' });
		const screen = render(PostCard, { post, locale: 'de' });

		const link = screen.getByRole('link', { name: 'Testbeitrag' });
		const href = link.element().getAttribute('href');
		expect(href).not.toBeNull();
		expect(href).toContain('/de');
		expect(href).toContain('accessible-combobox-from-scratch');
	});

	it('renders reading time from post.readingTimeMinutes, never a computed word count', async () => {
		const post = makePost({ readingTimeMinutes: 99 });
		const screen = render(PostCard, { post, locale: 'en' });

		await expect.element(screen.getByText('99 min read')).toBeInTheDocument();
	});

	it('exposes a single link per card to assistive tech', async () => {
		const post = makePost();
		const screen = render(PostCard, { post, locale: 'en' });

		// The card has two anchors to the same post (the h2 title and a visible "read more"
		// affordance), but the second is decorative — aria-hidden and out of the tab order — so
		// only one should surface via the accessible link role.
		const links = screen.container.querySelectorAll('a');
		expect(links).toHaveLength(2);

		const link = screen.getByRole('link');
		await expect.element(link).toHaveAccessibleName('Test Post');
	});
});
