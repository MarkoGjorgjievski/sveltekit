import { redirect, type Handle } from '@sveltejs/kit';
import { SESSION_COOKIE, readSession } from '$lib/server/auth/session';

const LOCALES = ['en', 'de'] as const;
const PASS_THROUGH = ['/api', '/sitemap.xml', '/robots.txt', '/favicon', '/_app', '/og'];
const LANGUAGE_TAG = /^([a-z]{2})(?:-[a-zA-Z]{2,4})?$/i;

// Exported so it can be unit-tested directly rather than only through a full `handle` request —
// `pathname.includes('/dashboard')` would also match `/en/blog/dashboard` (a plausible post slug)
// and `/en/dashboards`; matching the root or a `/`-bounded child is the actual route boundary.
export function isDashboardPath(pathname: string, locale: string): boolean {
	const root = `/${locale}/dashboard`;
	return pathname === root || pathname.startsWith(`${root}/`);
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const segment = pathname.split('/')[1];

	if (PASS_THROUGH.some((prefix) => pathname.startsWith(prefix))) {
		event.locals.locale = 'en';
	} else if (!(LOCALES as readonly string[]).includes(segment)) {
		const preferred = event.request.headers.get('accept-language')?.startsWith('de') ? 'de' : 'en';

		// A first segment shaped like a language tag is a locale attempt, not a path.
		// /en-GB/blog and /EN/blog mean /en/blog; prepending would give /en/en-GB/blog.
		const tag = segment.match(LANGUAGE_TAG);
		const base = tag?.[1].toLowerCase();
		const rest = base ? pathname.slice(segment.length + 1) || '/' : pathname;
		const target = base && (LOCALES as readonly string[]).includes(base) ? base : preferred;

		redirect(308, `/${target}${rest === '/' ? '' : rest}${event.url.search}`);
	} else {
		event.locals.locale = segment as 'en' | 'de';
	}

	const cookieTheme = event.cookies.get('theme');
	event.locals.theme = cookieTheme === 'dark' ? 'dark' : 'light';

	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = token ? await readSession(token) : null;

	// The guard lives here, in `handle`, rather than in a layout `load` — layout loads do not
	// necessarily re-run on every client-side navigation, so a layout-level guard can be bypassed
	// by navigating into the dashboard from an already-loaded page. `handle` runs on every request.
	// Form actions re-check permissions independently with `can()`; this only protects pages.
	if (isDashboardPath(event.url.pathname, event.locals.locale) && !event.locals.user) {
		const target = encodeURIComponent(event.url.pathname + event.url.search);
		redirect(303, `/${event.locals.locale}/login?redirectTo=${target}`);
	}

	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace(/<html[^>]*>/, (tag) =>
				tag.replace('%lang%', event.locals.locale).replace('%theme%', event.locals.theme)
			)
	});
};
