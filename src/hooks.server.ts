import { redirect, type Handle } from '@sveltejs/kit';

const LOCALES = ['en', 'de'] as const;
const PASS_THROUGH = ['/api', '/sitemap.xml', '/robots.txt', '/favicon', '/_app', '/og'];

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const segment = pathname.split('/')[1];

	if (PASS_THROUGH.some((prefix) => pathname.startsWith(prefix))) {
		event.locals.locale = 'en';
	} else if (!(LOCALES as readonly string[]).includes(segment)) {
		const preferred = event.request.headers.get('accept-language')?.startsWith('de') ? 'de' : 'en';
		redirect(308, `/${preferred}${pathname === '/' ? '' : pathname}${event.url.search}`);
	} else {
		event.locals.locale = segment as 'en' | 'de';
	}

	const cookieTheme = event.cookies.get('theme');
	event.locals.theme = cookieTheme === 'dark' ? 'dark' : 'light';

	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace(/<html[^>]*>/, (tag) =>
				tag.replace('%lang%', event.locals.locale).replace('%theme%', event.locals.theme)
			)
	});
};
