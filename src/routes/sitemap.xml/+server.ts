import { allSlugs, POSTS_PER_PAGE } from '$lib/server/data/posts.repo';
import { posts } from '$lib/server/data/fixtures';
import type { Post } from '$lib/schemas/post';
import type { RequestHandler } from './$types';

export const prerender = true;

const LOCALES = ['en', 'de'] as const;

// Page 1 lives at /blog, not /blog/page/1 (see blog/page/[n]/+page.server.ts), so the pager
// contributes pageCount - 1 paths, starting at n=2.
const pageCount = Math.ceil(posts.length / POSTS_PER_PAGE);
const pagerPaths = Array.from({ length: pageCount - 1 }, (_, index) => `/blog/page/${index + 2}`);

// PostSchema.slug is regex-constrained today (no '&', '<', '>', or '"' can occur in a real
// fixture entry), but that constraint lives in a different file (post.ts) with nothing tying it
// to this one — escape defensively so a future slug pattern change, or any other future path
// source, can't ship invalid XML.
//
// Underscore-prefixed so this is exported for the spec file (see theme-action.spec.ts's
// _isSameOrigin for the same convention) without SvelteKit rejecting it — +server.ts route
// modules only allow HTTP-verb exports plus a fixed set of route config names; anything else
// 500s at request time unless it starts with '_'.
export function _xmlEscape(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// Factored out (rather than inlined in GET) so a test can build the document from a fabricated
// path/post list without touching the real fixture. Underscore-prefixed for the same reason as
// _xmlEscape above.
export function _buildEntries(origin: string, paths: string[], allPosts: Post[]): string {
	return LOCALES.flatMap((locale) =>
		paths.map((path) => {
			const loc = _xmlEscape(`${origin}/${locale}${path}`);
			const alternates = LOCALES.map(
				(alt) =>
					`<xhtml:link rel="alternate" hreflang="${alt}" href="${_xmlEscape(`${origin}/${alt}${path}`)}"/>`
			).join('');
			const post = allPosts.find((entry) => path === `/blog/${entry.slug}`);
			const lastmod = post ? `<lastmod>${post.publishedAt}</lastmod>` : '';
			return `<url><loc>${loc}</loc>${lastmod}${alternates}</url>`;
		})
	).join('');
}

export const GET: RequestHandler = ({ url }) => {
	const origin = url.origin;
	const paths = [
		'',
		'/blog',
		'/search',
		...allSlugs().map((slug) => `/blog/${slug}`),
		...pagerPaths
	];

	const entries = _buildEntries(origin, paths, posts);

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries}</urlset>`,
		{ headers: { 'content-type': 'application/xml' } }
	);
};
