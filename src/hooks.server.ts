import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const cookieTheme = event.cookies.get('theme');
	event.locals.theme = cookieTheme === 'dark' ? 'dark' : 'light';
	event.locals.locale = 'en';

	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace(/<html[^>]*>/, (tag) =>
				tag.replace('%lang%', event.locals.locale).replace('%theme%', event.locals.theme)
			)
	});
};
