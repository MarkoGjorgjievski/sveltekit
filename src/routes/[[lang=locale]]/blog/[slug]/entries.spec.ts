import { describe, expect, it } from 'vitest';
import { allSlugs } from '$lib/server/data/posts.repo';
import { entries } from './+page.server';

describe('blog post entries()', () => {
	it('yields exactly 20 slugs x 2 locales, with no duplicates', async () => {
		const result = await entries();

		expect(result).toHaveLength(40);

		const keys = result.map((entry) => `${entry.lang}/${entry.slug}`);
		expect(new Set(keys).size).toBe(40);
	});

	it('covers every known slug in both locales', async () => {
		const result = await entries();
		const bySlug = new Map<string, Set<string>>();
		for (const entry of result) {
			// RouteParams types lang as optional (the [[lang=locale]] segment can be omitted), but
			// this route's own entries() always supplies one — fail loudly if that ever regresses.
			if (entry.lang === undefined) throw new Error('entries() omitted lang for a post entry');
			const langs = bySlug.get(entry.slug) ?? new Set<string>();
			langs.add(entry.lang);
			bySlug.set(entry.slug, langs);
		}

		for (const slug of allSlugs()) {
			expect(bySlug.get(slug)).toEqual(new Set(['en', 'de']));
		}
	});
});
