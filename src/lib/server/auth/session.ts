import { env } from '$env/dynamic/private';
import type { Role, User } from '$lib/schemas/user';

export const SESSION_COOKIE = 'demo_session';

export interface SessionUser {
	id: string;
	email: string;
	name: string;
	role: Role;
}

const SECRET = env.SESSION_SECRET ?? 'dev-only-insecure-secret-change-in-production';

async function key(): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(SECRET),
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
	const session: SessionUser = {
		id: user.id,
		email: user.email,
		name: user.name,
		role: user.role
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
		return JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as SessionUser;
	} catch {
		return null;
	}
}
