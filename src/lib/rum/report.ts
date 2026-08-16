import type { Beacon } from '$lib/schemas/beacon';
import { sessionId } from './session';
import { send } from './transport';

type ErrorBeacon = Extract<Beacon, { kind: 'error' }>;

// BeaconSchema bounds these, and the endpoint rejects anything longer outright. Truncating here
// means a long stack is still reported, shortened, rather than silently 400ing and reporting
// nothing at all — which is the failure mode you least want from an error reporter.
const MAX_MESSAGE = 500;
const MAX_STACK = 4000;

function truncate(value: string, limit: number): string {
	return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

/**
 * Normalizes anything throwable into the wire shape.
 *
 * Pure and exported so the shaping — which is where the bugs live — can be tested without a DOM.
 * `unknown` is the honest parameter type: JavaScript permits throwing strings, objects, or
 * nothing at all, and an error reporter that assumes `instanceof Error` misses precisely the
 * unusual throws worth knowing about.
 */
export function toErrorBeacon(error: unknown, path: string, id: string): ErrorBeacon {
	const beacon: ErrorBeacon = {
		kind: 'error',
		message: truncate(errorMessage(error), MAX_MESSAGE),
		path: truncate(path, 2048),
		sessionId: truncate(id, 100)
	};

	const stack =
		error instanceof Error && error.stack ? truncate(error.stack, MAX_STACK) : undefined;
	return stack ? { ...beacon, stack } : beacon;
}

function errorMessage(error: unknown): string {
	if (error instanceof Error) return error.message || error.name;
	if (typeof error === 'string') return error;

	try {
		return JSON.stringify(error) ?? String(error);
	} catch {
		// Circular structures, and objects with a throwing toJSON, both land here.
		return String(error);
	}
}

/**
 * Suppresses a repeat of the same error on the same path inside a short window.
 *
 * app.html sets data-sveltekit-preload-data="hover", so a link's load runs once when the pointer
 * reaches it and again when it is clicked. For a route whose load throws, that is two identical
 * reports from one user gesture — double the volume, double the cost, and an inflated count of
 * how many people actually hit the bug.
 *
 * The clock is a parameter so the window is testable without waiting on it.
 */
export function createDeduper(windowMs = 2000) {
	let last: { key: string; at: number } | null = null;

	return function allow(key: string, now: number): boolean {
		if (last && last.key === key && now - last.at < windowMs) return false;
		last = { key, at: now };
		return true;
	};
}

const allow = createDeduper();

/**
 * The single seam a real service replaces.
 *
 * Shaped like Sentry's `captureException` so swapping the sink is this one object, not a hunt
 * through both hooks for call sites.
 */
export const sink = {
	capture(beacon: ErrorBeacon): void {
		send(beacon);
	}
};

export function reportError(error: unknown, path: string): void {
	try {
		const beacon = toErrorBeacon(error, path, sessionId());

		// U+0000 as the separator: it cannot appear in a pathname, so no message can be crafted to
		// collide with a different path's key.
		if (!allow(beacon.path + String.fromCharCode(0) + beacon.message, Date.now())) return;

		sink.capture(beacon);
	} catch {
		// An error reporter that throws while reporting an error turns one broken page into two.
	}
}
