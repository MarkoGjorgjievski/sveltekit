import type { LayoutServerLoad } from './$types';

export const config = { runtime: 'nodejs22.x' };
export const prerender = false;

// The hook-level guard in hooks.server.ts already redirects anonymous requests before this ever
// runs, so `locals.user` is populated here. It is still exposed as `null` in the type rather than
// asserted non-null, because a layout load being reachable is not a proof obligation the type
// system can see — the guard living in a different file is exactly the kind of thing that could
// regress silently.
export const load: LayoutServerLoad = ({ locals }) => ({ user: locals.user });
