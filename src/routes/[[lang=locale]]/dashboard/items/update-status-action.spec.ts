import { beforeEach, describe, expect, it } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import { DEFAULT_QUERY } from '$lib/url/query-codec';
import { queryItems, resetItemStore } from '$lib/server/data/items.repo';
import { actions } from './+page.server';
import type { SessionUser } from '$lib/server/auth/session';
import type { Item } from '$lib/schemas/item';

// The route-scoped event type actions.updateStatus actually expects (narrower than the
// unparametrized RequestEvent from '@sveltejs/kit', which allows a route id this route can never
// have).
type UpdateStatusEvent = Parameters<typeof actions.updateStatus>[0];

// `isActionFailure`'s type predicate (`e is ActionFailure`) narrows to the type's default
// generic parameter (`ActionFailure<undefined>`), not to the specific `{ reason }` shape this
// action's `fail(...)` calls actually send — that specific shape (and, symmetrically, the success
// branch's `{ item }` shape) only exists on the concrete object literal `actions.updateStatus` was
// assigned from, which the `Actions`-typed `actions` export widens away to
// `Record<string, any> | void`. Naming the wire shapes explicitly here is more honest than
// fighting that generic, since these tests are asserting exactly what the action puts on the wire.
type UpdateStatusFailureData = { reason: 'role' | 'archived' | 'invalid' | 'missing' };
type UpdateStatusSuccessData = { item: Item };

const origin = 'http://localhost:5173';

beforeEach(resetItemStore);

const editor: SessionUser = {
	id: 'u_1',
	email: 'editor@demo.test',
	name: 'Editor',
	role: 'editor'
};
const admin: SessionUser = { id: 'u_0', email: 'admin@demo.test', name: 'Admin', role: 'admin' };
const viewer: SessionUser = {
	id: 'u_2',
	email: 'viewer@demo.test',
	name: 'Viewer',
	role: 'viewer'
};

// Builds a real, spec-compliant RequestEvent so these tests exercise the actual action
// (`actions.updateStatus`) end to end — matching the pattern login-action.spec.ts and
// theme-action.spec.ts already use for this project's other actions.
function buildEvent(user: SessionUser | null, body: Record<string, string>): UpdateStatusEvent {
	const url = new URL(`${origin}/en/dashboard/items`);
	url.search = '?/updateStatus';

	const form = new FormData();
	for (const [key, value] of Object.entries(body)) form.set(key, value);

	const cookieStore = new Map<string, string>();
	const cookies: UpdateStatusEvent['cookies'] = {
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

	// The action never reads `tracing` — it carries real @opentelemetry/api Span objects that
	// would take real work to fabricate for zero test value, so this one unused field is cast.
	const tracing = { enabled: false } as UpdateStatusEvent['tracing'];

	return {
		cookies,
		fetch,
		getClientAddress: () => '127.0.0.1',
		locals: { locale: 'en', theme: 'light', user },
		params: {},
		platform: undefined,
		request: new Request(url, { method: 'POST', body: form }),
		route: { id: '/[[lang=locale]]/dashboard/items' },
		setHeaders: () => {},
		url,
		isDataRequest: false,
		isSubRequest: false,
		isRemoteRequest: false,
		tracing
	};
}

function archivedRowId(): string {
	const row = queryItems({ ...DEFAULT_QUERY, status: ['archived'], perPage: 10 }).rows[0];
	if (!row) throw new Error('fixture data has no archived row to test against');
	return row.id;
}

function draftRow(): { id: string; name: string } {
	const row = queryItems({ ...DEFAULT_QUERY, status: ['draft'], perPage: 10 }).rows[0];
	if (!row) throw new Error('fixture data has no draft row to test against');
	return row;
}

function draftRowId(): string {
	return draftRow().id;
}

describe('updateStatus action — authorization', () => {
	// `handle` already keeps a viewer off this route entirely, but the action is a separate POST
	// entry point a route guard doesn't cover — it must authorize itself.
	it('returns fail(403) with reason "role" for a viewer, even with an otherwise valid submission', async () => {
		const id = draftRowId();
		const result = await actions.updateStatus(buildEvent(viewer, { id, status: 'active' }));

		expect(isActionFailure(result)).toBe(true);
		if (isActionFailure(result)) {
			expect(result.status).toBe(403);
			expect((result.data as UpdateStatusFailureData | undefined)?.reason).toBe('role');
		}
	});

	it('returns fail(403) for an unauthenticated request', async () => {
		const id = draftRowId();
		const result = await actions.updateStatus(buildEvent(null, { id, status: 'active' }));

		expect(isActionFailure(result)).toBe(true);
		if (isActionFailure(result)) {
			expect(result.status).toBe(403);
		}
	});

	it('succeeds for an editor', async () => {
		const id = draftRowId();
		const result = await actions.updateStatus(buildEvent(editor, { id, status: 'active' }));

		expect(isActionFailure(result)).toBe(false);
		if (!isActionFailure(result)) {
			expect((result as UpdateStatusSuccessData).item.status).toBe('active');
		}
	});

	it('succeeds for an admin', async () => {
		const id = draftRowId();
		const result = await actions.updateStatus(buildEvent(admin, { id, status: 'paused' }));

		expect(isActionFailure(result)).toBe(false);
		if (!isActionFailure(result)) {
			expect((result as UpdateStatusSuccessData).item.status).toBe('paused');
		}
	});
});

describe('updateStatus action — validation and mutation errors', () => {
	it('returns fail(409) with reason "archived" for an archived row, and leaves it unchanged', async () => {
		const id = archivedRowId();
		const result = await actions.updateStatus(buildEvent(editor, { id, status: 'active' }));

		expect(isActionFailure(result)).toBe(true);
		if (isActionFailure(result)) {
			expect(result.status).toBe(409);
			expect((result.data as UpdateStatusFailureData | undefined)?.reason).toBe('archived');
		}

		const stillArchived = queryItems({ ...DEFAULT_QUERY, status: ['archived'], perPage: 10 }).rows;
		expect(stillArchived.some((row) => row.id === id)).toBe(true);
	});

	it('returns fail(400) with reason "invalid" for a status outside ITEM_STATUSES', async () => {
		const id = draftRowId();
		const result = await actions.updateStatus(
			buildEvent(editor, { id, status: 'not-a-real-status' })
		);

		expect(isActionFailure(result)).toBe(true);
		if (isActionFailure(result)) {
			expect(result.status).toBe(400);
			expect((result.data as UpdateStatusFailureData | undefined)?.reason).toBe('invalid');
		}
	});

	it('returns fail(404) with reason "missing" for an id that does not exist', async () => {
		const result = await actions.updateStatus(
			buildEvent(editor, { id: 'cmp_nope', status: 'active' })
		);

		expect(isActionFailure(result)).toBe(true);
		if (isActionFailure(result)) {
			expect(result.status).toBe(404);
			expect((result.data as UpdateStatusFailureData | undefined)?.reason).toBe('missing');
		}
	});

	it('persists the change so a later query observes it', async () => {
		const { id, name } = draftRow();
		await actions.updateStatus(buildEvent(editor, { id, status: 'completed' }));

		// Searched by the row's own name rather than filtered by status and paged through 220 rows
		// — this doesn't depend on how many of the fixture's other rows already happen to be
		// "completed", only on this specific row's own persisted status.
		const refetched = queryItems({ ...DEFAULT_QUERY, q: name, perPage: 10 }).rows;
		expect(refetched.some((row) => row.id === id && row.status === 'completed')).toBe(true);
	});
});
