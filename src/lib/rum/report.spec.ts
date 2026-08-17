import { describe, expect, it } from 'vitest';
import { BeaconSchema } from '$lib/schemas/beacon';
import { createDeduper, toErrorBeacon } from './report';

const path = '/en/blog';
const id = 'session-1';

describe('toErrorBeacon', () => {
	it('produces a payload the endpoint accepts', () => {
		const beacon = toErrorBeacon(new Error('boom'), path, id);
		expect(BeaconSchema.safeParse(beacon).success).toBe(true);
	});

	it('carries the message and stack of a real Error', () => {
		const beacon = toErrorBeacon(new Error('boom'), path, id);
		expect(beacon.message).toBe('boom');
		expect(beacon.stack).toContain('Error: boom');
	});

	it('falls back to the error name when the message is empty', () => {
		expect(toErrorBeacon(new TypeError(''), path, id).message).toBe('TypeError');
	});

	it('handles the things JavaScript actually lets you throw', () => {
		// An error reporter that assumes `instanceof Error` misses exactly the unusual throws
		// worth knowing about.
		expect(toErrorBeacon('a bare string', path, id).message).toBe('a bare string');
		expect(toErrorBeacon({ code: 42 }, path, id).message).toBe('{"code":42}');
		expect(toErrorBeacon(null, path, id).message).toBe('null');
		expect(toErrorBeacon(undefined, path, id).message).toBe('undefined');
	});

	it('survives a value that cannot be serialised', () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		expect(() => toErrorBeacon(circular, path, id)).not.toThrow();

		const hostile = {
			toJSON() {
				throw new Error('nope');
			}
		};
		expect(() => toErrorBeacon(hostile, path, id)).not.toThrow();
	});

	it('omits stack entirely rather than sending undefined for a non-Error', () => {
		expect('stack' in toErrorBeacon('bare', path, id)).toBe(false);
	});

	it('truncates to the schema bounds so a long stack still reports something', () => {
		const error = new Error('x'.repeat(900));
		error.stack = 'y'.repeat(9000);

		const beacon = toErrorBeacon(error, path, id);

		expect(beacon.message).toHaveLength(500);
		expect(beacon.stack).toHaveLength(4000);
		// The real assertion: truncated output is still ACCEPTED. Sending the untruncated payload
		// would 400 and the error would go unreported, which is the worst outcome available.
		expect(BeaconSchema.safeParse(beacon).success).toBe(true);
	});
});

describe('createDeduper', () => {
	it('drops a repeat of the same key inside the window', () => {
		const allow = createDeduper(2000);
		expect(allow('a', 0)).toBe(true);
		expect(allow('a', 1)).toBe(false);
		expect(allow('a', 1999)).toBe(false);
	});

	it('allows the same key again once the window has passed', () => {
		const allow = createDeduper(2000);
		expect(allow('a', 0)).toBe(true);
		expect(allow('a', 2000)).toBe(true);
	});

	it('never suppresses a different key', () => {
		// The real risk of deduping: swallowing a genuinely different error that happens to arrive
		// while the window is open.
		const allow = createDeduper(2000);
		expect(allow('a', 0)).toBe(true);
		expect(allow('b', 1)).toBe(true);
		expect(allow('a', 2)).toBe(true);
	});

	it('measures the window from the last accepted report, not the first', () => {
		const allow = createDeduper(2000);
		expect(allow('a', 0)).toBe(true);
		expect(allow('a', 2500)).toBe(true);
		expect(allow('a', 3000)).toBe(false);
	});
});
