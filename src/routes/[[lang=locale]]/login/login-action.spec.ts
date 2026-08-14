import { describe, expect, it } from 'vitest';
import { isActionFailure, isRedirect } from '@sveltejs/kit';
import { actions } from './+page.server';
import { SESSION_COOKIE, readSession } from '$lib/server/auth/session';

// The route-scoped event type actions.default actually expects (narrower than the
// unparametrized RequestEvent from '@sveltejs/kit', which allows a route id this route can
// never have).
type LoginActionEvent = Parameters<typeof actions.default>[0];

const origin = 'http://localhost:5173';

// Builds a real, spec-compliant RequestEvent so these tests exercise the actual action
// (`actions.default`), not just its helpers in isolation — session.spec.ts already covers
// createSession/readSession/can(); nothing before this covered the action that wires them
// together, and on this project an action has shipped broken while its helper's unit tests
// still passed.
function buildEvent(body: Record<string, string>): {
	event: LoginActionEvent;
	cookieStore: Map<string, string>;
} {
	const url = new URL(`${origin}/en/login`);
	const form = new FormData();
	for (const [key, value] of Object.entries(body)) form.set(key, value);

	const cookieStore = new Map<string, string>();
	const cookies: LoginActionEvent['cookies'] = {
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
	const tracing = { enabled: false } as LoginActionEvent['tracing'];

	const event: LoginActionEvent = {
		cookies,
		fetch,
		getClientAddress: () => '127.0.0.1',
		locals: { locale: 'en', theme: 'light', user: null },
		params: {},
		platform: undefined,
		request: new Request(url, { method: 'POST', body: form }),
		route: { id: '/[[lang=locale]]/login' },
		setHeaders: () => {},
		url,
		isDataRequest: false,
		isSubRequest: false,
		isRemoteRequest: false,
		tracing
	};

	return { event, cookieStore };
}

describe('login action', () => {
	it('signs in a valid editor, sets an HttpOnly cookie, and redirects to redirectTo', async () => {
		const { event, cookieStore } = buildEvent({
			email: 'editor@demo.test',
			password: 'demo1234',
			redirectTo: '/en/dashboard/items'
		});

		let thrown: unknown;
		try {
			await actions.default(event);
		} catch (error) {
			thrown = error;
		}

		expect(isRedirect(thrown)).toBe(true);
		if (isRedirect(thrown)) {
			expect(thrown.status).toBe(303);
			expect(thrown.location).toBe('/en/dashboard/items');
		}

		const token = cookieStore.get(SESSION_COOKIE);
		expect(token).toBeDefined();

		const session = token ? await readSession(token) : null;
		expect(session?.email).toBe('editor@demo.test');
		expect(session?.role).toBe('editor');
	});

	it('normalises a capitalised email before comparing against the fixture', async () => {
		const { event, cookieStore } = buildEvent({
			email: 'Editor@Demo.Test',
			password: 'demo1234'
		});

		let thrown: unknown;
		try {
			await actions.default(event);
		} catch (error) {
			thrown = error;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect(cookieStore.has(SESSION_COOKIE)).toBe(true);
	});

	it('discards a cross-origin redirectTo and falls back to the dashboard', async () => {
		const { event } = buildEvent({
			email: 'editor@demo.test',
			password: 'demo1234',
			redirectTo: '//evil.test'
		});

		let thrown: unknown;
		try {
			await actions.default(event);
		} catch (error) {
			thrown = error;
		}

		expect(isRedirect(thrown)).toBe(true);
		if (isRedirect(thrown)) {
			expect(thrown.location).toBe('/en/dashboard/items');
		}
	});

	it('rejects a wrong password with fail(401) and sets no cookie', async () => {
		const { event, cookieStore } = buildEvent({
			email: 'editor@demo.test',
			password: 'wrong-password'
		});

		const result = await actions.default(event);

		expect(isActionFailure(result)).toBe(true);
		if (isActionFailure(result)) {
			expect(result.status).toBe(401);
		}
		expect(cookieStore.has(SESSION_COOKIE)).toBe(false);
	});

	it('rejects a password under the schema minimum with fail(400) before touching fixtures', async () => {
		const { event, cookieStore } = buildEvent({
			email: 'editor@demo.test',
			password: 'short'
		});

		const result = await actions.default(event);

		expect(isActionFailure(result)).toBe(true);
		if (isActionFailure(result)) {
			expect(result.status).toBe(400);
		}
		expect(cookieStore.has(SESSION_COOKIE)).toBe(false);
	});
});
