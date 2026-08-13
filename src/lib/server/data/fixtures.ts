import { z } from 'zod';
import { ItemSchema, type Item } from '$lib/schemas/item';
import { PostSchema, type Post } from '$lib/schemas/post';
import { UserSchema, type User } from '$lib/schemas/user';
import rawItems from '$lib/fixtures/items.json';
import rawPosts from '$lib/fixtures/posts.json';
import rawUsers from '$lib/fixtures/users.json';

export interface FixtureResult<T> {
	valid: T[];
	dropped: number;
	issues: string[];
}

export function parseFixture<T>(
	schema: z.ZodType<T>,
	raw: unknown,
	label: string
): FixtureResult<T> {
	if (!Array.isArray(raw)) {
		return { valid: [], dropped: 0, issues: [`${label}: payload is not an array`] };
	}

	const valid: T[] = [];
	const issues: string[] = [];

	raw.forEach((record, index) => {
		const parsed = schema.safeParse(record);
		if (parsed.success) {
			valid.push(parsed.data);
			return;
		}
		const detail = parsed.error.issues
			.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
			.join('; ');
		issues.push(`${label}[${index}] ${detail}`);
	});

	return { valid, dropped: issues.length, issues };
}

const itemResult = parseFixture(ItemSchema, rawItems, 'items');
const postResult = parseFixture(PostSchema, rawPosts, 'posts');
const userResult = parseFixture(UserSchema, rawUsers, 'users');

export const items: Item[] = itemResult.valid;
export const posts: Post[] = postResult.valid;
export const users: User[] = userResult.valid;

export const fixtureHealth = {
	dropped: itemResult.dropped + postResult.dropped + userResult.dropped,
	issues: [...itemResult.issues, ...postResult.issues, ...userResult.issues]
};
