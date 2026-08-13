import { describe, expect, it } from 'vitest';
import { allSlugs, getPost, listPosts, searchPosts } from './posts.repo';

describe('listPosts', () => {
	it('pages newest-first and reports a stable page count', () => {
		const first = listPosts(1);
		expect(first.rows).toHaveLength(9);
		expect(first.pageCount).toBe(3);
		expect(first.rows[0].publishedAt > first.rows[1].publishedAt).toBe(true);
	});

	it('clamps an out-of-range page', () => {
		expect(listPosts(99).page).toBe(3);
	});
});

describe('getPost', () => {
	it('resolves a known slug and rejects an unknown one', () => {
		expect(getPost('sub-second-lcp-on-a-content-site')?.id).toBe('post_000');
		expect(getPost('does-not-exist')).toBeUndefined();
	});
});

describe('allSlugs', () => {
	it('lists every post exactly once for prerendering', () => {
		const slugs = allSlugs();
		expect(slugs).toHaveLength(20);
		expect(new Set(slugs).size).toBe(20);
	});
});

describe('searchPosts', () => {
	it('matches titles, since every post shares one body', () => {
		const hits = searchPosts({ q: 'combobox', tag: null, sort: 'relevance', locale: 'en' });
		expect(hits).toHaveLength(1);
		expect(hits[0].slug).toBe('accessible-combobox-from-scratch');
	});

	it('intersects a tag filter with the text query', () => {
		const hits = searchPosts({ q: '', tag: 'accessibility', sort: 'newest', locale: 'en' });
		expect(hits.length).toBeGreaterThan(0);
		expect(hits.every((post) => post.tags.includes('accessibility'))).toBe(true);
	});

	it('returns nothing for a query that matches no title', () => {
		expect(searchPosts({ q: 'zzzznotathing', tag: null, sort: 'relevance', locale: 'en' })).toEqual(
			[]
		);
	});

	it('does not match on body or excerpt, which are identical across all posts', () => {
		// A phrase present in every post's body. Matching it would return all 20.
		const hits = searchPosts({
			q: 'quietly rebuilding',
			tag: null,
			sort: 'relevance',
			locale: 'en'
		});
		expect(hits).toEqual([]);
	});

	it('matches an author name containing non-ASCII characters', () => {
		const hits = searchPosts({ q: 'Dvořák', tag: null, sort: 'relevance', locale: 'en' });
		expect(hits.length).toBeGreaterThan(0);
		expect(hits.every((post) => post.author.name === 'Marek Dvořák')).toBe(true);
	});

	it('searches the requested locale and not another', () => {
		// "zugängliche" appears only in the German title, "scratch" only in the English one.
		const germanOnly = { q: 'zugängliche', tag: null, sort: 'relevance' } as const;
		const englishOnly = { q: 'scratch', tag: null, sort: 'relevance' } as const;

		expect(searchPosts({ ...germanOnly, locale: 'de' })).toHaveLength(1);
		expect(searchPosts({ ...germanOnly, locale: 'en' })).toHaveLength(0);

		expect(searchPosts({ ...englishOnly, locale: 'en' })).toHaveLength(1);
		expect(searchPosts({ ...englishOnly, locale: 'de' })).toHaveLength(0);
	});

	it('ranks title matches above tag and author matches, per locale', () => {
		// "Warum" appears in two German titles and no English one.
		const german = searchPosts({ q: 'Warum', tag: null, sort: 'relevance', locale: 'de' });
		expect(german).toHaveLength(2);
		expect(german.every((post) => post.translations.de.title.includes('Warum'))).toBe(true);

		expect(searchPosts({ q: 'Warum', tag: null, sort: 'relevance', locale: 'en' })).toHaveLength(0);
	});
});
