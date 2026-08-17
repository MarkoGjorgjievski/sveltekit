/**
 * Deterministic sampling, separated from the browser-only reporting code so it can be tested
 * without a DOM.
 */

/** FNV-1a, mapped onto [0, 1). Stable across runs and processes, unlike Math.random(). */
export function hashUnitInterval(value: string): number {
	let accumulator = 2166136261;
	for (let index = 0; index < value.length; index++) {
		accumulator ^= value.charCodeAt(index);
		accumulator = Math.imul(accumulator, 16777619);
	}
	return (accumulator >>> 0) / 4294967296;
}

/**
 * Whether a session reports at all.
 *
 * Keyed on the session id, not rolled per metric: sampling each metric independently mixes one
 * session's LCP with a different session's INP, and percentiles computed over that describe no
 * user who ever existed. A session reports everything or nothing.
 *
 * `?rum` forces inclusion so the path can be demonstrated without waiting on a 1-in-10 roll.
 */
export function shouldSample(sessionId: string, sampleRate: number, search: string): boolean {
	if (new URLSearchParams(search).has('rum')) return true;
	if (sampleRate <= 0) return false;
	if (sampleRate >= 1) return true;
	return hashUnitInterval(sessionId) < sampleRate;
}
