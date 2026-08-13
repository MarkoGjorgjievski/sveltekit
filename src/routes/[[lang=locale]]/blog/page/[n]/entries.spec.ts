import { describe, expect, it } from 'vitest';
import { posts } from '$lib/server/data/fixtures';
import { POSTS_PER_PAGE } from '$lib/server/data/posts.repo';
import { entries } from './+page.server';

describe('blog pager entries()', () => {
	it('yields one entry per locale for every page after the first, computed from the fixture', async () => {
		const pageCount = Math.ceil(posts.length / POSTS_PER_PAGE);
		const expectedCount = 2 * (pageCount - 1);

		const result = await entries();

		expect(result).toHaveLength(expectedCount);
		// Pins the concrete number so a change to the fixture or POSTS_PER_PAGE is visible here,
		// not just in the computed assertion above (20 posts / 9 per page = 3 pages, page 1 lives
		// at /blog, so 2 pager pages x 2 locales).
		expect(result).toHaveLength(4);
	});

	it('never generates page 1, which lives at /blog', async () => {
		const result = await entries();
		expect(result.some((entry) => entry.n === '1')).toBe(false);
	});

	it('generates no duplicate lang/page combinations', async () => {
		const result = await entries();
		const keys = result.map((entry) => `${entry.lang}/${entry.n}`);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('covers both locales for every generated page', async () => {
		const result = await entries();
		const pageCount = Math.ceil(posts.length / POSTS_PER_PAGE);
		for (let n = 2; n <= pageCount; n += 1) {
			expect(result).toContainEqual({ lang: 'en', n: String(n) });
			expect(result).toContainEqual({ lang: 'de', n: String(n) });
		}
	});
});
