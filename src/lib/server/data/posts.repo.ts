import type { Locale, Post } from '$lib/schemas/post';
import { posts } from './fixtures';

export const POSTS_PER_PAGE = 9;

const byNewest = [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export function listPosts(page: number, perPage: number = POSTS_PER_PAGE) {
	const pageCount = Math.max(1, Math.ceil(byNewest.length / perPage));
	const safePage = Math.min(Math.max(page, 1), pageCount);
	const start = (safePage - 1) * perPage;
	return { rows: byNewest.slice(start, start + perPage), page: safePage, pageCount };
}

export function getPost(slug: string): Post | undefined {
	return posts.find((post) => post.slug === slug);
}

export function allSlugs(): string[] {
	return posts.map((post) => post.slug);
}

export function searchPosts(input: {
	q: string;
	tag: string | null;
	sort: 'newest' | 'oldest' | 'relevance';
	locale: Locale;
}): Post[] {
	const needle = input.q.trim().toLowerCase();

	const hits = byNewest.filter((post) => {
		if (input.tag && !post.tags.includes(input.tag)) return false;
		if (!needle) return true;
		const haystack = [post.translations[input.locale].title, post.author.name, ...post.tags]
			.join(' ')
			.toLowerCase();
		return haystack.includes(needle);
	});

	if (input.sort === 'oldest') return [...hits].reverse();
	if (input.sort === 'newest') return hits;

	return [...hits].sort((a, b) => {
		const aTitle = a.translations[input.locale].title.toLowerCase().includes(needle) ? 0 : 1;
		const bTitle = b.translations[input.locale].title.toLowerCase().includes(needle) ? 0 : 1;
		return aTitle - bTitle;
	});
}
