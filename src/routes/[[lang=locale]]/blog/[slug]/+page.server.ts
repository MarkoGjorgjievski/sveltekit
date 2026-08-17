import { error } from '@sveltejs/kit';
import { allSlugs, getPost } from '$lib/server/data/posts.repo';
import type { EntryGenerator, PageServerLoad } from './$types';
import { localeFromParams } from '$lib/i18n/locale';

export const prerender = true;

export const entries: EntryGenerator = () =>
	(['en', 'de'] as const).flatMap((lang) => allSlugs().map((slug) => ({ lang, slug })));

export const load: PageServerLoad = ({ params, locals }) => {
	const post = getPost(params.slug);
	if (!post) error(404, 'No such post');
	return { post, locale: localeFromParams(params.lang, locals.locale) };
};
