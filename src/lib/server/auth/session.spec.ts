import { afterEach, describe, expect, it, vi } from 'vitest';
import { can } from './permissions';

// $env/dynamic/private is mocked (rather than mutating process.env) so `SESSION_SECRET` and
// `VERCEL_ENV` can be flipped per test without depending on how SvelteKit's dev-vs-build env
// module actually snapshots process.env. session.ts reads `env` fresh on every call (no
// top-level caching), so mutating properties on this shared object between tests is enough.
const mockEnv = vi.hoisted(() => ({
	SESSION_SECRET: undefined as string | undefined,
	VERCEL_ENV: undefined as string | undefined
}));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { createSession, readSession } = await import('./session');

const user = {
	id: 'demo_editor',
	email: 'editor@demo.test',
	name: 'Demo Editor',
	role: 'editor' as const,
	password: 'demo1234'
};

afterEach(() => {
	mockEnv.SESSION_SECRET = undefined;
	mockEnv.VERCEL_ENV = undefined;
	vi.useRealTimers();
});

describe('session', () => {
	it('round-trips a signed token', async () => {
		const session = await readSession(await createSession(user));
		expect(session?.email).toBe('editor@demo.test');
		expect(session?.role).toBe('editor');
	});

	it('rejects a token whose payload was swapped for an admin one', async () => {
		const token = await createSession(user);
		const signature = token.split('.')[1];
		const forged = Buffer.from(
			JSON.stringify({ id: 'demo_admin', email: 'a@b.c', name: 'x', role: 'admin' })
		).toString('base64url');
		expect(await readSession(`${forged}.${signature}`)).toBeNull();
	});

	it('rejects a malformed token without throwing', async () => {
		expect(await readSession('garbage')).toBeNull();
	});

	// A tampered payload with a copied signature is one attack; a token forged end-to-end with a
	// different secret is another. Both must fail — this catches a verify() that only checks
	// payload/signature shape without actually validating the HMAC against our secret.
	it('rejects a token signed with a different secret', async () => {
		const token = await createSession(user);
		const [payload] = token.split('.');

		const otherKey = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode('a-completely-different-secret'),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		const forgedSignature = await crypto.subtle.sign(
			'HMAC',
			otherKey,
			new TextEncoder().encode(payload)
		);
		const signature = Buffer.from(forgedSignature).toString('base64url');

		expect(await readSession(`${payload}.${signature}`)).toBeNull();
	});
});

describe('secret resolution', () => {
	it('throws when deployed to Vercel production without SESSION_SECRET set', async () => {
		mockEnv.VERCEL_ENV = 'production';
		mockEnv.SESSION_SECRET = undefined;

		await expect(createSession(user)).rejects.toThrow(/SESSION_SECRET/);
	});

	it('does not throw outside of Vercel production, even without SESSION_SECRET', async () => {
		mockEnv.VERCEL_ENV = undefined;
		mockEnv.SESSION_SECRET = undefined;

		await expect(createSession(user)).resolves.toEqual(expect.any(String));
	});

	it('uses SESSION_SECRET when it is set, even in Vercel production', async () => {
		mockEnv.VERCEL_ENV = 'production';
		mockEnv.SESSION_SECRET = 'a-real-production-secret';

		await expect(createSession(user)).resolves.toEqual(expect.any(String));
	});
});

describe('expiry', () => {
	it('rejects a token past its 8-hour expiry even with a valid signature', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
		const token = await createSession(user);

		vi.setSystemTime(new Date('2026-01-01T08:00:01Z'));
		expect(await readSession(token)).toBeNull();
	});

	it('accepts a token still inside its 8-hour window', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
		const token = await createSession(user);

		vi.setSystemTime(new Date('2026-01-01T07:59:59Z'));
		const session = await readSession(token);
		expect(session?.email).toBe('editor@demo.test');
	});
});

describe('can', () => {
	it('allows admin and editor to update items but not viewer', () => {
		expect(can({ id: '1', email: 'a', name: 'a', role: 'admin' }, 'item:update')).toBe(true);
		expect(can({ id: '2', email: 'b', name: 'b', role: 'editor' }, 'item:update')).toBe(true);
		expect(can({ id: '3', email: 'c', name: 'c', role: 'viewer' }, 'item:update')).toBe(false);
		expect(can(null, 'item:update')).toBe(false);
	});

	it('returns false for every action when the user is null', () => {
		const actions = ['item:update'] as const;
		for (const action of actions) {
			expect(can(null, action)).toBe(false);
		}
	});
});
