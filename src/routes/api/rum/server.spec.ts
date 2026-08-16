import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

// The route-scoped event type POST actually expects.
type RumEvent = Parameters<typeof POST>[0];

function post(body: BodyInit | null): Promise<Response> {
	const request = new Request('http://localhost/api/rum', { method: 'POST', body });
	return Promise.resolve(POST({ request } as RumEvent)) as Promise<Response>;
}

const vital = {
	kind: 'vital',
	name: 'LCP',
	value: 1234.5,
	rating: 'good',
	path: '/en',
	sessionId: 'session-1'
};

let logged: string[];

beforeEach(() => {
	logged = [];
	vi.spyOn(console, 'log').mockImplementation((line: string) => void logged.push(line));
});

afterEach(() => vi.restoreAllMocks());

describe('POST /api/rum', () => {
	it('accepts a valid beacon with 204 and no body', async () => {
		const response = await post(JSON.stringify(vital));

		expect(response.status).toBe(204);
		expect(await response.text()).toBe('');
	});

	it('logs the beacon with a timestamp', async () => {
		await post(JSON.stringify(vital));

		expect(logged).toHaveLength(1);
		const entry = JSON.parse(logged[0]);
		expect(entry).toMatchObject(vital);
		expect(Number.isNaN(Date.parse(entry.at))).toBe(false);
	});

	it('rejects a malformed beacon with 400', async () => {
		const response = await post(JSON.stringify({ ...vital, name: 'FID' }));
		expect(response.status).toBe(400);
	});

	it('rejects a body that is not JSON at all', async () => {
		const response = await post('not json');
		expect(response.status).toBe(400);
	});

	it('rejects an empty body rather than throwing', async () => {
		const response = await post(null);
		expect(response.status).toBe(400);
	});

	it('never logs input it rejected', async () => {
		// The reason validation happens before the log call: this endpoint is public and
		// unauthenticated, and whatever reaches console.log reaches the log stream verbatim.
		await post(JSON.stringify({ kind: 'vital', name: 'LCP\n{"forged":"entry"}' }));

		expect(logged).toEqual([]);
	});

	it('drops unknown fields instead of passing them through to the sink', async () => {
		await post(JSON.stringify({ ...vital, injected: 'x'.repeat(50) }));

		expect(logged).toHaveLength(1);
		expect(JSON.parse(logged[0])).not.toHaveProperty('injected');
	});
});
