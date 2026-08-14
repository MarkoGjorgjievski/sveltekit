import { describe, expect, it } from 'vitest';
import type { Post } from '$lib/schemas/post';
import { load } from './+page.server';
import type { PageServerLoadEvent } from './$types';

// Builds a real, spec-compliant ServerLoadEvent so these tests exercise the actual `load`
// function against a real URL, not just a query-string parsed in isolation — see the blog pager's
// entries.spec.ts for the same pattern.
function buildLoadEvent(search: string): PageServerLoadEvent {
	const origin = 'http://localhost:5173';
	const url = new URL(`${origin}/en/search${search}`);

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
		params: {},
		platform: undefined,
		request: new Request(url),
		route: { id: '/[[lang=locale]]/search' },
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

// The declared PageServerLoad return type is technically nullable (SvelteKit allows a load
// function to return void), but this implementation always returns data — guard rather than
// assert-non-null so a real regression to "no data" still fails loudly here.
async function loadSearch(search: string) {
	const result = await load(buildLoadEvent(search));
	if (result === undefined) throw new Error('load() unexpectedly returned no data');
	return result;
}

describe('search page load()', () => {
	it('degrades an unknown tag to null rather than filtering every post away', async () => {
		const result = await loadSearch('?tag=does-not-exist');

		expect(result.tag).toBeNull();
		// A filter that silently returned zero posts for a typo'd or stale tag URL would look like
		// a broken search, so the fallback must actually reach the repo call, not just the field.
		expect(result.results.length).toBeGreaterThan(0);
	});

	it('keeps a known tag and narrows results to it', async () => {
		const result = await loadSearch('?tag=accessibility');

		expect(result.tag).toBe('accessibility');
		expect(result.results.every((post: Post) => post.tags.includes('accessibility'))).toBe(true);
	});

	it('falls back an unknown sort to relevance', async () => {
		const result = await loadSearch('?sort=bogus');

		expect(result.sort).toBe('relevance');
	});

	it('accepts each real sort value unchanged', async () => {
		expect((await loadSearch('?sort=newest')).sort).toBe('newest');
		expect((await loadSearch('?sort=oldest')).sort).toBe('oldest');
		expect((await loadSearch('?sort=relevance')).sort).toBe('relevance');
	});

	it('trims q before it reaches the repo and before it comes back out', async () => {
		const result = await loadSearch('?q=%20%20combobox%20%20');

		expect(result.q).toBe('combobox');
		expect(result.results).toHaveLength(1);
		expect(result.results[0].slug).toBe('accessible-combobox-from-scratch');
	});

	it('defaults q to an empty string and sort to relevance with no params at all', async () => {
		const result = await loadSearch('');

		expect(result.q).toBe('');
		expect(result.sort).toBe('relevance');
		expect(result.tag).toBeNull();
		expect(result.results).toHaveLength(20);
	});
});
