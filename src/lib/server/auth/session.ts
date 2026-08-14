import { env } from '$env/dynamic/private';
import type { Role, User } from '$lib/schemas/user';

export const SESSION_COOKIE = 'demo_session';

export interface SessionUser {
	id: string;
	email: string;
	name: string;
	role: Role;
}

// The signed payload carries its own expiry so a copied token can't outlive it — the cookie's
// Max-Age is a client-side hint the browser is free to ignore, not a security boundary.
interface SessionPayload extends SessionUser {
	exp: number;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours, matches the cookie's Max-Age

// Resolved lazily on every call (never cached at module scope) so a missing SESSION_SECRET is
// only ever a hard failure on an actual Vercel deployment.
//
// A local production build and `npm run preview` both set NODE_ENV=production too — Task 24's
// Lighthouse run depends on `npm run preview` working unauthenticated-secret-free, and prerendering
// happens at build time before any real secret would exist — so NODE_ENV can't be the gate.
// VERCEL_ENV is only ever set by an actual Vercel deployment, which is exactly the boundary that
// matters: signing production cookies with a secret anyone can read in the repository is the
// vulnerability, not running a local prod-mode build.
function secret(): string {
	const configured = env.SESSION_SECRET;
	if (configured) return configured;

	if (env.VERCEL_ENV === 'production') {
		throw new Error(
			'SESSION_SECRET must be set in production — refusing to sign with the development fallback'
		);
	}

	return 'dev-only-insecure-secret-change-in-production';
}

async function key(): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret()),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	return btoa(String.fromCharCode(...view))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
	const padded = value
		.replace(/-/g, '+')
		.replace(/_/g, '/')
		.padEnd(Math.ceil(value.length / 4) * 4, '=');
	// Wrapped in `new Uint8Array(...)` (rather than returned directly from `.from()`) so the
	// result is backed by a concrete ArrayBuffer, not the wider ArrayBufferLike that
	// `Uint8Array.from()` infers — crypto.subtle.verify's BufferSource parameter requires the former.
	return new Uint8Array(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)));
}

// Web Crypto (crypto.subtle) rather than node:crypto, so this module runs unchanged on both the
// Node and edge runtimes.
export async function createSession(user: User): Promise<string> {
	const session: SessionPayload = {
		id: user.id,
		email: user.email,
		name: user.name,
		role: user.role,
		exp: Date.now() + SESSION_TTL_MS
	};
	const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(session)));
	const signature = await crypto.subtle.sign(
		'HMAC',
		await key(),
		new TextEncoder().encode(payload)
	);
	return `${payload}.${toBase64Url(signature)}`;
}

export async function readSession(token: string): Promise<SessionUser | null> {
	const [payload, signature] = token.split('.');
	if (!payload || !signature) return null;

	try {
		const valid = await crypto.subtle.verify(
			'HMAC',
			await key(),
			fromBase64Url(signature),
			new TextEncoder().encode(payload)
		);
		if (!valid) return null;

		// Verify the signature before parsing (and before trusting `exp`) — an attacker-controlled
		// payload must never be inspected until its authenticity is established.
		const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as SessionPayload;
		if (Date.now() > session.exp) return null;

		return session;
	} catch {
		return null;
	}
}
