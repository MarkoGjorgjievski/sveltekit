import { describe, expect, it } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { posts } from '$lib/server/data/fixtures';
import { POSTS_PER_PAGE } from '$lib/server/data/posts.repo';
import { entries, load } from './+page.server';
import type { PageServerLoadEvent } from './$types';

// Builds a real, spec-compliant ServerLoadEvent so the guard test below exercises the actual
// `load` function, not just a param string in isolation — that catches the guard being loosened
// (or the wrong status being thrown) in a way a pure entries()-shape assertion never would.
function buildLoadEvent(n: string): PageServerLoadEvent {
	const origin = 'http://localhost:5173';
	const url = new URL(`${origin}/en/blog/page/${n}`);

	const cookieStore = new Map<string, string>();
	const cookies: PageServerLoadEvent['cookies'] = {
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

	// The load function never reads `tracing` — it carries real @opentelemetry/api Span objects
	// that would take real work to fabricate for zero test value, so this one unused field is cast.
	const tracing = { enabled: false } as PageServerLoadEvent['tracing'];

	return {
		cookies,
		fetch,
		getClientAddress: () => '127.0.0.1',
		locals: { locale: 'en', theme: 'light', user: null },
		params: { n },
		platform: undefined,
		request: new Request(url),
		route: { id: '/[[lang=locale]]/blog/page/[n]' },
		setHeaders: () => {},
		url,
		isDataRequest: false,
		isSubRequest: false,
		isRemoteRequest: false,
		tracing,
		parent: () => Promise.resolve({ locale: 'en', theme: 'light' }),
		depends: () => {},
		untrack: (fn) => fn()
	};
}

describe('blog pager entries()', () => {
	it('yields one entry per locale for every page after the first, computed from the fixture', async () => {
		const pageCount = Math.ceil(posts.length / POSTS_PER_PAGE);
		const expectedCount = 2 * (pageCount - 1);

		const result = await entries();

		expect(result).toHaveLength(expectedCount);
		// Pins the concrete number so a change to the fixture or POSTS_PER_PAGE is visible here,
		// not just in the computed assertion above (20 posts / 9 per page = 3 pages, page 1 lives
		// at /blog, so 2 pager pages x 2 locales).
		expect(result).toHaveLength(4);
	});

	it('never generates page 1, which lives at /blog', async () => {
		const result = await entries();
		expect(result.some((entry) => entry.n === '1')).toBe(false);
	});

	it('generates no duplicate lang/page combinations', async () => {
		const result = await entries();
		const keys = result.map((entry) => `${entry.lang}/${entry.n}`);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('covers both locales for every generated page', async () => {
		const result = await entries();
		const pageCount = Math.ceil(posts.length / POSTS_PER_PAGE);
		for (let n = 2; n <= pageCount; n += 1) {
			expect(result).toContainEqual({ lang: 'en', n: String(n) });
			expect(result).toContainEqual({ lang: 'de', n: String(n) });
		}
	});
});

describe('blog pager load()', () => {
	it('rejects page 1, which lives at /blog', async () => {
		let thrown: unknown;
		try {
			await load(buildLoadEvent('1'));
		} catch (caught) {
			thrown = caught;
		}

		expect(isHttpError(thrown)).toBe(true);
		if (isHttpError(thrown)) {
			expect(thrown.status).toBe(404);
		}
	});

	it('accepts a page that was actually generated', async () => {
		const result = await load(buildLoadEvent('2'));
		// The declared PageServerLoad return type is technically nullable (SvelteKit allows a load
		// function to return void), but this implementation always returns data — guard rather than
		// assert-non-null so a real regression to "no data" still fails loudly here.
		if (result === undefined) throw new Error('load() unexpectedly returned no data');
		expect(result.page).toBe(2);
	});
});
