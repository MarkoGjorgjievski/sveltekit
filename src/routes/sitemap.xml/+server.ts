import { allSlugs, POSTS_PER_PAGE } from '$lib/server/data/posts.repo';
import { posts } from '$lib/server/data/fixtures';
import type { RequestHandler } from './$types';

export const prerender = true;

const LOCALES = ['en', 'de'] as const;

// Page 1 lives at /blog, not /blog/page/1 (see blog/page/[n]/+page.server.ts), so the pager
// contributes pageCount - 1 paths, starting at n=2.
const pageCount = Math.ceil(posts.length / POSTS_PER_PAGE);
const pagerPaths = Array.from({ length: pageCount - 1 }, (_, index) => `/blog/page/${index + 2}`);

export const GET: RequestHandler = ({ url }) => {
	const origin = url.origin;
	const paths = [
		'',
		'/blog',
		'/search',
		...allSlugs().map((slug) => `/blog/${slug}`),
		...pagerPaths
	];

	const entries = LOCALES.flatMap((locale) =>
		paths.map((path) => {
			const loc = `${origin}/${locale}${path}`;
			const alternates = LOCALES.map(
				(alt) => `<xhtml:link rel="alternate" hreflang="${alt}" href="${origin}/${alt}${path}"/>`
			).join('');
			const post = posts.find((entry) => path === `/blog/${entry.slug}`);
			const lastmod = post ? `<lastmod>${post.publishedAt}</lastmod>` : '';
			return `<url><loc>${loc}</loc>${lastmod}${alternates}</url>`;
		})
	).join('');

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries}</urlset>`,
		{ headers: { 'content-type': 'application/xml' } }
	);
};
