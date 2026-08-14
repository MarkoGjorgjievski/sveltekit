import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import tags from '$lib/fixtures/tags.json';
import type { Post } from '$lib/schemas/post';
import Page from './+page.svelte';
import type { PageProps } from './$types';

const { gotoMock, beforeNavigateMock } = vi.hoisted(() => ({
	gotoMock: vi.fn(),
	beforeNavigateMock: vi.fn()
}));

// $app/navigation is mocked so the race test below can (a) observe every goto() call instead of
// SvelteKit attempting a real client-side navigation with no router mounted, and (b) capture the
// callback the component registers via beforeNavigate() and invoke it directly to simulate the
// instant a real navigation — a tag click, Back/Forward — starts.
vi.mock('$app/navigation', () => ({
	goto: gotoMock,
	beforeNavigate: beforeNavigateMock
}));

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

beforeEach(() => {
	gotoMock.mockClear();
	beforeNavigateMock.mockClear();
});

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

	it('renders the no-results copy with a clear-search link, and the tag pills drop the failing query', async () => {
		const screen = render(Page, props({ q: 'zzzznothing', results: [] }));

		await expect
			.element(screen.getByText('No matches. Try a different query.'))
			.toBeInTheDocument();

		// The clear-search link keeps the tag but must drop the failing query.
		const clearLink = screen.getByRole('link', { name: 'Clear search' });
		await expect.element(clearLink).toBeInTheDocument();
		const clearHref = await clearLink.element().getAttribute('href');
		expect(clearHref).not.toBeNull();
		expect(clearHref).not.toContain('zzzznothing');

		// searchPosts ANDs tag and query, so a tag pill that carried the failing query forward
		// would still return zero results — not a recovery at all. Every pill must drop it.
		for (const tag of tags) {
			const link = screen.getByRole('link', { name: tag.label.en });
			const href = await link.element().getAttribute('href');
			expect(href).not.toBeNull();
			expect(href).not.toContain('zzzznothing');
		}
	});

	it('cancels a pending debounced navigation when a real navigation starts first', async () => {
		const screen = render(Page, props());
		expect(beforeNavigateMock).toHaveBeenCalledTimes(1);

		// Arm the 250ms debounce timer, exactly as a keystroke in the query box would.
		const box = screen.getByRole('searchbox');
		await box.fill('stale text');
		expect(gotoMock).not.toHaveBeenCalled();

		// Simulate what SvelteKit does immediately before an in-route navigation lands — a tag
		// click or Back/Forward — by invoking the callback the component registered.
		const onNavigate = beforeNavigateMock.mock.calls[0][0] as () => void;
		onNavigate();

		// Let the 250ms debounce window pass for real.
		await new Promise((resolve) => setTimeout(resolve, 400));

		// The stale timer must not fire after a navigation already claimed this instant — otherwise
		// it calls goto() built from stale query text but live facet state, replacing the entry the
		// user just navigated to.
		expect(gotoMock).not.toHaveBeenCalled();
	});
});
