import { describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';
import type { PageServerLoadEvent } from './$types';
import type { SessionUser } from '$lib/server/auth/session';

// queryItems is mocked to throw so this file can exercise the catch path in loadItems() without
// needing a real broken fixture. The rest of the suite (load.spec.ts) exercises the real repo.
vi.mock('$lib/server/data/items.repo', () => ({
	queryItems: () => {
		throw new Error('backend unavailable');
	}
}));

function buildLoadEvent(): PageServerLoadEvent {
	const origin = 'http://localhost:5173';
	const url = new URL(`${origin}/en/dashboard/items`);
	const user: SessionUser = {
		id: 'u_1',
		email: 'editor@demo.test',
		name: 'Editor',
		role: 'editor'
	};

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

	const tracing = { enabled: false } as PageServerLoadEvent['tracing'];

	return {
		cookies,
		fetch,
		getClientAddress: () => '127.0.0.1',
		locals: { locale: 'en', theme: 'light', user },
		params: {},
		platform: undefined,
		request: new Request(url),
		route: { id: '/[[lang=locale]]/dashboard/items' },
		setHeaders: () => {},
		url,
		isDataRequest: false,
		isSubRequest: false,
		isRemoteRequest: false,
		tracing,
		parent: () => Promise.resolve({ locale: 'en', theme: 'light', user }),
		depends: () => {},
		untrack: (fn) => fn()
	};
}

// `load` is declared with the `PageServerLoad` type, whose call signature is `MaybePromise<...>`
// (SvelteKit allows a load function to return its data directly or wrapped in a promise), so the
// call site sees that union even though this implementation always returns synchronously.
// Awaiting collapses the union to the real data or `void`; guarding on `undefined` rather than
// asserting non-null means a real regression to "no data" still fails loudly here — see
// search/load.spec.ts for the same pattern.
async function loadItems(event: PageServerLoadEvent) {
	const result = await load(event);
	if (result === undefined) throw new Error('load() unexpectedly returned no data');
	return result;
}

describe('dashboard/items load() when the repo throws', () => {
	it('resolves `result` to a load_failed Result', async () => {
		const data = await loadItems(buildLoadEvent());

		await expect(data.result).resolves.toMatchObject({ ok: false, reason: 'load_failed' });
	});

	it('never rejects', async () => {
		// A rejected streamed promise would tear down the whole page's error boundary — shell,
		// nav and filters included — destroying the partial-failure design. `loadItems` must
		// catch and resolve, never reject; a plain resolves.toMatchObject above would pass even
		// if it also had a reject path nobody hit, so this asserts absence of rejection directly.
		const data = await loadItems(buildLoadEvent());
		await expect(data.result).resolves.toBeDefined();

		let rejected = false;
		try {
			await data.result;
		} catch {
			rejected = true;
		}
		expect(rejected).toBe(false);
	});
});
