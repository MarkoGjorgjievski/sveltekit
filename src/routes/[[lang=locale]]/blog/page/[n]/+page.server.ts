import { error } from '@sveltejs/kit';
import { listPosts, POSTS_PER_PAGE } from '$lib/server/data/posts.repo';
import { posts } from '$lib/server/data/fixtures';
import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = true;

// Page 1 lives at /blog, not /blog/page/1, so entries starts at n=2 — pageCount - 1 pages per
// locale. Prerendering /blog/page/1 too would build a byte-identical duplicate of /blog under a
// second URL, which is wasted build output and a canonicalization footgun.
export const entries: EntryGenerator = () => {
	const pageCount = Math.ceil(posts.length / POSTS_PER_PAGE);
	const pages = Array.from({ length: pageCount - 1 }, (_, index) => String(index + 2));
	return (['en', 'de'] as const).flatMap((lang) => pages.map((n) => ({ lang, n })));
};

export const load: PageServerLoad = ({ params, locals }) => {
	const requested = Number(params.n);
	if (!Number.isInteger(requested) || requested < 1) error(404, 'No such page');

	const result = listPosts(requested);
	if (result.page !== requested) error(404, 'No such page');

	return { locale: locals.locale, ...result };
};
