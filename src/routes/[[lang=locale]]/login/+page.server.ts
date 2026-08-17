import { fail, redirect } from '@sveltejs/kit';
import { CredentialsSchema } from '$lib/schemas/user';
import { users } from '$lib/server/data/fixtures';
import { SESSION_COOKIE, createSession } from '$lib/server/auth/session';
import { isSameOrigin } from '$lib/server/url';
import type { Actions, PageServerLoad } from './$types';
import { localeFromParams } from '$lib/i18n/locale';

export const config = { runtime: 'nodejs22.x' };
export const prerender = false;

export const load: PageServerLoad = ({ params, locals, url }) => ({
	locale: localeFromParams(params.lang, locals.locale),
	redirectTo: url.searchParams.get('redirectTo') ?? `/${locals.locale}/dashboard/items`
});

// Both fail() branches below share this shape (rather than each inferring its own literal
// `errors` type) so `form?.errors?.email` type-checks in +page.svelte without a discriminant —
// the schema-validation and wrong-credentials failures are both just "a field or form message".
interface LoginFailure {
	email: string;
	errors: Record<string, string>;
}

export const actions: Actions = {
	default: async ({ request, cookies, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const requested = String(form.get('redirectTo') ?? '');
		const fallback = `/${locals.locale}/dashboard/items`;

		const parsed = CredentialsSchema.safeParse({
			email,
			password: String(form.get('password') ?? '')
		});

		if (!parsed.success) {
			return fail<LoginFailure>(400, {
				email,
				errors: Object.fromEntries(
					parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])
				)
			});
		}

		// CredentialsSchema accepts "Admin@demo.test", but the fixture stores "admin@demo.test".
		// Email local parts are case-sensitive per RFC 5321, but virtually no real provider treats
		// them that way, and a user typing a capitalised email is not an edge case worth an error
		// message for a login form. Normalise to lowercase on both sides before comparing.
		const normalizedEmail = parsed.data.email.trim().toLowerCase();
		const user = users.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);

		// Deliberately the same failure for "no such user" and "wrong password" — a distinct
		// message would let an attacker enumerate which demo emails exist.
		if (!user || user.password !== parsed.data.password) {
			return fail<LoginFailure>(401, { email, errors: { form: 'invalid' } });
		}

		cookies.set(SESSION_COOKIE, await createSession(user), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			// Derived from the actual request protocol, not NODE_ENV — `npm run preview` (which
			// Task 24's Lighthouse run drives) sets NODE_ENV=production while serving plain HTTP,
			// and a Secure cookie over HTTP is one the browser silently refuses to send back.
			secure: url.protocol === 'https:',
			maxAge: 60 * 60 * 8
		});

		// requested must be a same-origin path, otherwise it is discarded: //evil.test is
		// protocol-relative and would otherwise be an open redirect off the login form.
		const target = requested !== '' && isSameOrigin(requested, url.origin) ? requested : fallback;

		redirect(303, target);
	}
};
