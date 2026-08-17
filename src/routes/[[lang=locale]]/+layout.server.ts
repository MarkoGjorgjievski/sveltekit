import type { LayoutServerLoad } from './$types';
import { localeFromParams } from '$lib/i18n/locale';

export const load: LayoutServerLoad = ({ params, locals }) => ({
	locale: localeFromParams(params.lang, locals.locale),
	theme: locals.theme
});
