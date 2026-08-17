import type { EntryGenerator, PageServerLoad } from './$types';
import { localeFromParams } from '$lib/i18n/locale';

export const prerender = true;

export const entries: EntryGenerator = () => [{ lang: 'en' }, { lang: 'de' }];

export const load: PageServerLoad = ({ params, locals }) => ({
	locale: localeFromParams(params.lang, locals.locale)
});
