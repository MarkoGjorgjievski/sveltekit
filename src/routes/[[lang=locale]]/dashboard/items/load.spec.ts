import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_QUERY } from '$lib/url/query-codec';
import { resetItemStore } from '$lib/server/data/items.repo';
import { load } from './+page.server';
import type { PageServerLoadEvent } from './$types';
import type { SessionUser } from '$lib/server/auth/session';

beforeEach(resetItemStore);

// Builds a real, spec-compliant ServerLoadEvent so these tests exercise the actual `load`
// function against a real URL and a spy-able `depends`, not just its helpers in isolation — see
// search/load.spec.ts for the same pattern.
function buildLoadEvent(
	user: SessionUser | null,
	depends: (key: string) => void = () => {}
): PageServerLoadEvent {
	const origin = 'http://localhost:5173';
	const url = new URL(`${origin}/en/dashboard/items`);

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
		depends,
		untrack: (fn) => fn()
	};
}

const editor: SessionUser = {
	id: 'u_1',
	email: 'editor@demo.test',
	name: 'Editor',
	role: 'editor'
};
const viewer: SessionUser = {
	id: 'u_2',
	email: 'viewer@demo.test',
	name: 'Viewer',
	role: 'viewer'
};

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

describe('dashboard/items load()', () => {
	it('returns `result` as an un-awaited promise — the streamed part of the response', async () => {
		const data = await loadItems(buildLoadEvent(editor));

		expect(data.result).toBeInstanceOf(Promise);
	});

	it('resolves `result` to an ok Result carrying the default page of rows', async () => {
		const data = await loadItems(buildLoadEvent(editor));

		const result = await data.result;

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.page.rows).toHaveLength(DEFAULT_QUERY.perPage);
			expect(result.page.total).toBe(220);
			expect(result.health.dropped).toBe(0);
		}
	});

	it('registers the app:items invalidation key, not a blanket invalidateAll', async () => {
		const dependsSpy = vi.fn();

		await loadItems(buildLoadEvent(editor, dependsSpy));

		expect(dependsSpy).toHaveBeenCalledWith('app:items');
	});

	it('grants canEdit to an editor', async () => {
		const data = await loadItems(buildLoadEvent(editor));

		expect(data.canEdit).toBe(true);
	});

	it('withholds canEdit from a viewer', async () => {
		const data = await loadItems(buildLoadEvent(viewer));

		expect(data.canEdit).toBe(false);
	});
});
