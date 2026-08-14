import { describe, expect, it } from 'vitest';
import { createSession, readSession } from './session';
import { can } from './permissions';

const user = {
	id: 'demo_editor',
	email: 'editor@demo.test',
	name: 'Demo Editor',
	role: 'editor' as const,
	password: 'demo1234'
};

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
