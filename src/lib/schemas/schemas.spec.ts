import { describe, expect, it } from 'vitest';
import items from '$lib/fixtures/items.json';
import { ItemSchema } from './item';
import { PostSchema } from './post';
import { CredentialsSchema, UserSchema } from './user';

const valid = (items as unknown[])[0] as Record<string, unknown>;

describe('ItemSchema', () => {
	it('accepts an unmodified fixture record', () => {
		expect(ItemSchema.safeParse(valid).success).toBe(true);
	});

	it.each([
		['ctr above 1', { ctr: 1.5 }],
		['negative budget', { budget: -1 }],
		['negative spent', { spent: -0.01 }],
		['unknown status', { status: 'zombie' }],
		['unknown channel', { channel: 'carrier-pigeon' }],
		['fractional clicks', { clicks: 1.5 }],
		['startDate in the wrong format', { startDate: '31/05/2026' }],
		['updatedAt that is not ISO 8601', { updatedAt: 'yesterday' }],
		['an owner missing its name', { owner: { id: 'u_x' } }]
	])('rejects %s', (_label, override) => {
		expect(ItemSchema.safeParse({ ...valid, ...override }).success).toBe(false);
	});
});

describe('PostSchema', () => {
	it('rejects an object missing every required field', () => {
		expect(PostSchema.safeParse({ id: 'x' }).success).toBe(false);
	});
});

describe('UserSchema', () => {
	it('rejects an invalid email', () => {
		expect(
			UserSchema.safeParse({ id: 'a', email: 'nope', password: 'p', name: 'n', role: 'admin' })
				.success
		).toBe(false);
	});

	it('rejects an unknown role', () => {
		expect(
			UserSchema.safeParse({ id: 'a', email: 'a@b.co', password: 'p', name: 'n', role: 'root' })
				.success
		).toBe(false);
	});
});

describe('CredentialsSchema', () => {
	it('accepts the real demo credentials', () => {
		expect(
			CredentialsSchema.safeParse({ email: 'admin@demo.test', password: 'demo1234' }).success
		).toBe(true);
	});

	it('rejects a password under the minimum length', () => {
		expect(CredentialsSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false);
	});
});
