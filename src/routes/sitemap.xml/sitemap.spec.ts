import { describe, expect, it } from 'vitest';
import { allSlugs, POSTS_PER_PAGE } from '$lib/server/data/posts.repo';
import { posts } from '$lib/server/data/fixtures';
import { _buildEntries, GET } from './+server';
import type { Post } from '$lib/schemas/post';
import type { RequestEvent } from '@sveltejs/kit';

type SitemapEvent = Parameters<typeof GET>[0];

const origin = 'http://localhost:5173';

// Builds a real, spec-compliant RequestEvent so the handler is exercised end to end rather than
// just a helper in isolation — the handler only reads `url` off the event, but typing it as the
// full RequestEvent (rather than an `any`/partial cast) keeps this test honest about the real
// contract the route exports.
function buildEvent(path = '/sitemap.xml'): SitemapEvent {
	const url = new URL(`${origin}${path}`);

	const cookieStore = new Map<string, string>();
	const cookies: RequestEvent['cookies'] = {
		get: (name) => cookieStore.get(name),
		getAll: () => [...cookieStore].map(([name, value]) => ({ name, value })),
		set: (name, value) => {
			cookieStore.set(name, value);
		},
		delete: (name) => {
			cookieStore.delete(name);
		},
		serialize: () => ''
	};

	const tracing = { enabled: false } as RequestEvent['tracing'];

	return {
		cookies,
		fetch,
		getClientAddress: () => '127.0.0.1',
		locals: { locale: 'en', theme: 'light', user: null },
		params: {},
		platform: undefined,
		request: new Request(url),
		route: { id: '/sitemap.xml' },
		setHeaders: () => {},
		url,
		isDataRequest: false,
		isSubRequest: false,
		isRemoteRequest: false,
		tracing
	};
}

// Mirrors the route's own pager math (page 1 lives at /blog, not /blog/page/1) so the expected
// count is derived from the fixture rather than hardcoded — a change to the fixture size or
// POSTS_PER_PAGE should move this number, not silently desync from it.
const pageCount = Math.ceil(posts.length / POSTS_PER_PAGE);
const pathsPerLocale = 3 + allSlugs().length + (pageCount - 1);
const expectedUrlCount = pathsPerLocale * 2;

describe('GET /sitemap.xml', () => {
	it('responds with application/xml', async () => {
		const response = await GET(buildEvent());
		expect(response.headers.get('content-type')).toBe('application/xml');
	});

	it('contains one <url> per expected path per locale, computed from the fixture', async () => {
		const response = await GET(buildEvent());
		const body = await response.text();
		const matches = body.match(/<url>/g) ?? [];

		expect(matches).toHaveLength(expectedUrlCount);
		// Pins the concrete number so a change to the fixture or pager math is visible here, not
		// just in the computed assertion above (3 static paths + 20 slugs + 2 pager pages = 25
		// paths per locale, x2 locales).
		expect(matches).toHaveLength(50);
	});

	it('uses the plural sitemaps.org namespace and declares the xhtml namespace', async () => {
		const response = await GET(buildEvent());
		const body = await response.text();
		expect(body).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
		// Dropping this while still emitting <xhtml:link> elements would be invalid XML — the
		// prefix would be undeclared even though every other assertion here still passes.
		expect(body).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
	});

	it('gives every <loc> an absolute, locale-prefixed URL', async () => {
		const response = await GET(buildEvent());
		const body = await response.text();
		const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

		expect(locs).toHaveLength(expectedUrlCount);
		for (const loc of locs) {
			expect(loc.startsWith(origin)).toBe(true);
			expect(loc).toMatch(new RegExp(`^${origin}/(en|de)(/|$)`));
		}
	});

	it('includes the blog pager pages but never /blog/page/1', async () => {
		const response = await GET(buildEvent());
		const body = await response.text();

		expect(body).toContain(`<loc>${origin}/en/blog/page/2</loc>`);
		expect(body).toContain(`<loc>${origin}/en/blog/page/3</loc>`);
		expect(body).toContain(`<loc>${origin}/de/blog/page/2</loc>`);
		expect(body).toContain(`<loc>${origin}/de/blog/page/3</loc>`);
		expect(body).not.toContain('/blog/page/1');
	});

	it('includes every known post slug for both locales', async () => {
		const response = await GET(buildEvent());
		const body = await response.text();

		for (const slug of allSlugs()) {
			expect(body).toContain(`<loc>${origin}/en/blog/${slug}</loc>`);
			expect(body).toContain(`<loc>${origin}/de/blog/${slug}</loc>`);
		}
	});

	it('gives every <url> exactly two xhtml:link alternates, one per locale', async () => {
		const response = await GET(buildEvent());
		const body = await response.text();
		const urlBlocks = body.match(/<url>.*?<\/url>/g) ?? [];

		expect(urlBlocks).toHaveLength(expectedUrlCount);
		for (const block of urlBlocks) {
			const alternates = block.match(/<xhtml:link rel="alternate"/g) ?? [];
			expect(alternates).toHaveLength(2);
			expect(block).toContain('hreflang="en"');
			expect(block).toContain('hreflang="de"');
		}
	});
});

// PostSchema.slug is regex-constrained (no '&' can occur in a real fixture entry today), but
// that constraint lives in posts.ts and nothing ties it to this route — a future slug pattern
// change, or any other future path source, could otherwise ship invalid XML. _buildEntries is
// exported specifically so this can be exercised without touching the real fixture.
function makeStubPost(overrides: Partial<Post> = {}): Post {
	return {
		id: 'post_stub',
		slug: 'a&b',
		translations: {
			en: { title: 'Stub', excerpt: 'Stub excerpt', body: 'Stub body' },
			de: { title: 'Stub', excerpt: 'Stub Auszug', body: 'Stub Text' }
		},
		tags: [],
		author: { id: 'author_stub', name: 'Stub Author', avatarColor: '#000000' },
		publishedAt: '2026-01-01T00:00:00.000Z',
		readingTimeMinutes: 1,
		coverColor: '#000000',
		...overrides
	};
}

describe('_buildEntries XML escaping', () => {
	it('escapes an unsafe character in <loc> and every xhtml:link href, leaving no bare "&"', () => {
		const stubPost = makeStubPost({ slug: 'a&b' });
		const body = _buildEntries(origin, ['/blog/a&b'], [stubPost]);

		expect(body).toContain(`<loc>${origin}/en/blog/a&amp;b</loc>`);
		expect(body).toContain(`href="${origin}/de/blog/a&amp;b"`);
		// The escaped form never contains the raw, contiguous "a&b" sequence a bug would produce.
		expect(body).not.toContain('a&b');
	});
});
