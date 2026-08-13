import { describe, expect, it } from 'vitest';
import items from '$lib/fixtures/items.json';
import posts from '$lib/fixtures/posts.json';
import users from '$lib/fixtures/users.json';
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

const validPost = (posts as unknown[])[0] as Record<string, unknown>;
const validUser = (users as unknown[])[0] as Record<string, unknown>;
const author = validPost.author as Record<string, unknown>;
const translations = validPost.translations as Record<string, unknown>;

describe('PostSchema', () => {
	it('accepts an unmodified fixture record', () => {
		expect(PostSchema.safeParse(validPost).success).toBe(true);
	});

	it.each([
		['a slug with spaces and capitals', { slug: 'Not A Slug' }],
		['a coverColor missing its leading hash', { coverColor: '1e293b' }],
		['an avatarColor that is not hex', { author: { ...author, avatarColor: 'purple' } }],
		['a publishedAt with no time component', { publishedAt: '2026-05-31' }],
		['a readingTimeMinutes of zero', { readingTimeMinutes: 0 }],
		['a missing German translation', { translations: { en: translations.en } }],
		[
			'an empty title',
			{ translations: { ...translations, en: { ...(translations.en as object), title: '' } } }
		]
	])('rejects %s', (_label, override) => {
		expect(PostSchema.safeParse({ ...validPost, ...override }).success).toBe(false);
	});
});

describe('UserSchema', () => {
	it('accepts an unmodified fixture record', () => {
		expect(UserSchema.safeParse(validUser).success).toBe(true);
	});

	it.each([
		['an unknown role', { role: 'root' }],
		['a malformed email', { email: 'nope' }],
		['an empty password', { password: '' }]
	])('rejects %s', (_label, override) => {
		expect(UserSchema.safeParse({ ...validUser, ...override }).success).toBe(false);
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
