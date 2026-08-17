import { searchPosts } from '$lib/server/data/posts.repo';
import tags from '$lib/fixtures/tags.json';
import type { PageServerLoad } from './$types';
import { localeFromParams } from '$lib/i18n/locale';

// Query-dependent (q/tag/sort all vary per request) so the response can never be cached, the
// payload is small, and nothing here touches a Node API — an edge function is a strict win over a
// Node lambda for this route.
export const config = { runtime: 'edge' };
export const prerender = false;

const SORTS = ['newest', 'oldest', 'relevance'] as const;
type Sort = (typeof SORTS)[number];

export const load: PageServerLoad = ({ params, url, locals }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const requestedTag = url.searchParams.get('tag');
	const sortParam = url.searchParams.get('sort');

	const sort: Sort = (SORTS as readonly string[]).includes(sortParam ?? '')
		? (sortParam as Sort)
		: 'relevance';
	const tag = tags.some((entry) => entry.slug === requestedTag) ? requestedTag : null;

	return {
		q,
		tag,
		sort,
		tags,
		locale: localeFromParams(params.lang, locals.locale),
		results: searchPosts({ q, tag, sort, locale: localeFromParams(params.lang, locals.locale) })
	};
};
