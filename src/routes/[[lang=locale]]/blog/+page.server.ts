import { listPosts } from '$lib/server/data/posts.repo';
import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = true;
export const entries: EntryGenerator = () => [{ lang: 'en' }, { lang: 'de' }];

export const load: PageServerLoad = ({ locals }) => ({
	locale: locals.locale,
	...listPosts(1)
});
