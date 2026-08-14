import { describe, expect, it } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { _isSameOrigin as isSameOrigin, actions } from './+page.server';

// The route-scoped event type actions.theme actually expects (narrower than the unparametrized
// RequestEvent from '@sveltejs/kit', which allows a route id this route can never have).
type ThemeActionEvent = Parameters<typeof actions.theme>[0];

const origin = 'http://localhost:5173';

describe('isSameOrigin', () => {
	it('accepts a same-origin relative path', () => {
		expect(isSameOrigin('/en', origin)).toBe(true);
	});

	it('rejects a protocol-relative url that swaps the host', () => {
		expect(isSameOrigin('//evil.com', origin)).toBe(false);
	});

	it('rejects an absolute cross-origin url', () => {
		expect(isSameOrigin('https://evil.com', origin)).toBe(false);
	});

	it('rejects a backslash variant, which browsers treat as protocol-relative', () => {
		// For special schemes (http/https/...), a leading "/\" normalises the same way "//" does,
		// so "/\evil.com" resolves to http://evil.com — a prefix check on "//" alone misses this.
		expect(isSameOrigin('/\\evil.com', origin)).toBe(false);
	});

	it('treats an empty target as the origin root rather than a cross-origin bypass', () => {
		expect(isSameOrigin('', origin)).toBe(true);
	});
});

// Builds a real, spec-compliant RequestEvent so the tests below exercise the actual action
// (`actions.theme`) rather than just the `_isSameOrigin` helper in isolation — a unit test on
// the helper alone previously passed while a caller-side bug (fixed separately) broke the
// feature end to end.
function buildEvent(redirectTo?: string): ThemeActionEvent {
	const url = new URL(`${origin}/en/theme`);
	url.search = '?/theme';

	const form = new FormData();
	if (redirectTo !== undefined) form.set('redirectTo', redirectTo);

	const cookieStore = new Map<string, string>();
	const cookies: ThemeActionEvent['cookies'] = {
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
	const tracing = { enabled: false } as ThemeActionEvent['tracing'];

	return {
		cookies,
		fetch,
		getClientAddress: () => '127.0.0.1',
		locals: { locale: 'en', theme: 'light', user: null },
		params: {},
		platform: undefined,
		request: new Request(url, { method: 'POST', body: form }),
		route: { id: '/[[lang=locale]]/theme' },
		setHeaders: () => {},
		url,
		isDataRequest: false,
		isSubRequest: false,
		isRemoteRequest: false,
		tracing
	};
}

describe('theme action', () => {
	it('returns the user to the page they came from', async () => {
		const event = buildEvent('/en/blog');

		let thrown: unknown;
		try {
			await actions.theme(event);
		} catch (error) {
			thrown = error;
		}

		expect(isRedirect(thrown)).toBe(true);
		if (isRedirect(thrown)) {
			expect(thrown.status).toBe(303);
			expect(thrown.location).toBe('/en/blog');
		}
	});

	it('falls back to the locale root when the target is cross-origin', async () => {
		const event = buildEvent('https://evil.test/x');

		let thrown: unknown;
		try {
			await actions.theme(event);
		} catch (error) {
			thrown = error;
		}

		expect(isRedirect(thrown)).toBe(true);
		if (isRedirect(thrown)) {
			expect(thrown.status).toBe(303);
			expect(thrown.location).toBe('/en');
		}
	});
});
