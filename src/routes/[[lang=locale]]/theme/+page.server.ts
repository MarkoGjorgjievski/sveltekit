import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Only reachable via the form POST below; a stray GET (crawler, typed URL) bounces home.
export const load: PageServerLoad = ({ locals }) => {
	redirect(302, `/${locals.locale}`);
};

function isSafeRedirectTarget(path: FormDataEntryValue | null): path is string {
	return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}

export const actions: Actions = {
	theme: async ({ request, cookies }) => {
		const data = await request.formData();
		const redirectTo = data.get('redirectTo');
		const next = cookies.get('theme') === 'dark' ? 'light' : 'dark';

		cookies.set('theme', next, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });

		redirect(303, isSafeRedirectTarget(redirectTo) ? redirectTo : '/');
	}
};
