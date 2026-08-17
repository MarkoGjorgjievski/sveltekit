import { redirect } from '@sveltejs/kit';
import { isSameOrigin } from '$lib/server/url';
import type { Actions, PageServerLoad } from './$types';

// Only reachable via the form POST below; a stray GET (crawler, typed URL) bounces home.
export const load: PageServerLoad = ({ locals }) => {
	redirect(302, `/${locals.locale}`);
};

// `_`-prefixed so SvelteKit's route-module export validator allows it alongside `load`/`actions`
// (it rejects any other named export) while still letting the spec file import and unit-test it.
// The check itself lives in $lib/server/url so the login route can share the same logic instead
// of duplicating it.
export const _isSameOrigin = isSameOrigin;

export const actions: Actions = {
	theme: async ({ request, cookies, url, locals }) => {
		const data = await request.formData();
		const redirectTo = data.get('redirectTo');
		const next = cookies.get('theme') === 'dark' ? 'light' : 'dark';

		// httpOnly is explicitly OFF, against SvelteKit's default. This is a display preference, not
		// a credential, and the inline script in app.html has to be able to read it: the public
		// surface is prerendered, so its data-theme attribute is frozen at build time and the cookie
		// can only reach those pages through the client.
		cookies.set('theme', next, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365,
			sameSite: 'lax',
			httpOnly: false
		});

		const fallback = `/${locals.locale}`;
		const target =
			typeof redirectTo === 'string' && isSameOrigin(redirectTo, url.origin)
				? redirectTo
				: fallback;

		redirect(303, target);
	}
};
