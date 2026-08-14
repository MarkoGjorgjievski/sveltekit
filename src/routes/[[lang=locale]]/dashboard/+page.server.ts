import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE } from '$lib/server/auth/session';
import type { Actions } from './$types';

export const config = { runtime: 'nodejs22.x' };
export const prerender = false;

// This route is not in Task 15's file list, but the dashboard layout's sign-out form needs a
// +page.server.ts to post to — SvelteKit form actions live on +page.server.ts, not
// +layout.server.ts. This index page is a minimal placeholder; the real items table is Stage 4.
export const actions: Actions = {
	logout: async ({ cookies, locals }) => {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		redirect(303, `/${locals.locale}/login`);
	}
};
