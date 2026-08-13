import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Only reachable via the form POST below; a stray GET (crawler, typed URL) bounces home.
export const load: PageServerLoad = ({ locals }) => {
	redirect(302, `/${locals.locale}`);
};

// `_`-prefixed so SvelteKit's route-module export validator allows it alongside `load`/`actions`
// (it rejects any other named export) while still letting the spec file import and unit-test it.
//
// Comparing the resolved origin, rather than enumerating bad prefixes (`//`, `\`, ...), is what
// actually defeats an open redirect: a prefix denylist misses variants like a leading backslash,
// which browsers normalise to `//evil.com` for special schemes even though it "starts with /".
export function _isSameOrigin(target: string, origin: string): boolean {
	try {
		return new URL(target, origin).origin === origin;
	} catch {
		return false;
	}
}

export const actions: Actions = {
	theme: async ({ request, cookies, url, locals }) => {
		const data = await request.formData();
		const redirectTo = data.get('redirectTo');
		const next = cookies.get('theme') === 'dark' ? 'light' : 'dark';

		cookies.set('theme', next, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });

		const fallback = `/${locals.locale}`;
		const target =
			typeof redirectTo === 'string' && _isSameOrigin(redirectTo, url.origin)
				? redirectTo
				: fallback;

		redirect(303, target);
	}
};
