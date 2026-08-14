import { describe, expect, it } from 'vitest';
import { GET } from './+server';
import type { RequestEvent } from '@sveltejs/kit';

type RobotsEvent = Parameters<typeof GET>[0];

const origin = 'http://localhost:5173';

// Builds a real, spec-compliant RequestEvent so the handler is exercised end to end rather than
// just a helper in isolation.
function buildEvent(): RobotsEvent {
	const url = new URL(`${origin}/robots.txt`);

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
		route: { id: '/robots.txt' },
		setHeaders: () => {},
		url,
		isDataRequest: false,
		isSubRequest: false,
		isRemoteRequest: false,
		tracing
	};
}

describe('GET /robots.txt', () => {
	it('responds with plain text', async () => {
		const response = await GET(buildEvent());
		expect(response.headers.get('content-type')).toBe('text/plain');
	});

	it('disallows the dashboard and login for both locales', async () => {
		const response = await GET(buildEvent());
		const body = await response.text();

		expect(body).toContain('Disallow: /en/dashboard');
		expect(body).toContain('Disallow: /de/dashboard');
		expect(body).toContain('Disallow: /en/login');
		expect(body).toContain('Disallow: /de/login');
	});

	it('points at the sitemap using the request origin', async () => {
		const response = await GET(buildEvent());
		const body = await response.text();

		expect(body).toContain(`Sitemap: ${origin}/sitemap.xml`);
	});
});
