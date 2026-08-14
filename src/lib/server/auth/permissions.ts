import type { SessionUser } from './session';

// Authorization is role-based, never ownership-based: item owner ids (u_priya, u_jonas, ...) and
// login account ids (demo_admin, demo_editor, demo_viewer) are disjoint in the fixtures, so any
// "my campaigns" ownership scoping would match nothing.
const RULES = {
	'item:update': ['admin', 'editor']
} as const satisfies Record<string, readonly SessionUser['role'][]>;

export function can(user: SessionUser | null, action: keyof typeof RULES): boolean {
	return user !== null && (RULES[action] as readonly string[]).includes(user.role);
}
