import { describe, expect, it } from 'vitest';
import { BeaconSchema } from './beacon';

const vital = {
	kind: 'vital' as const,
	name: 'LCP' as const,
	value: 1234.5,
	rating: 'good' as const,
	path: '/en',
	sessionId: 'session-1'
};

describe('BeaconSchema', () => {
	it('accepts a well-formed vital', () => {
		expect(BeaconSchema.safeParse(vital).success).toBe(true);
	});

	it('accepts an error beacon with and without a stack', () => {
		const error = { kind: 'error', message: 'boom', path: '/en', sessionId: 'session-1' };
		expect(BeaconSchema.safeParse(error).success).toBe(true);
		expect(BeaconSchema.safeParse({ ...error, stack: 'at foo()' }).success).toBe(true);
	});

	it('rejects an unknown discriminant', () => {
		expect(BeaconSchema.safeParse({ ...vital, kind: 'other' }).success).toBe(false);
	});

	it('rejects a metric name outside the enum', () => {
		expect(BeaconSchema.safeParse({ ...vital, name: 'FID' }).success).toBe(false);
	});

	it('rejects NaN and Infinity, which JSON can carry in from a hand-rolled body', () => {
		expect(BeaconSchema.safeParse({ ...vital, value: Number.NaN }).success).toBe(false);
		expect(BeaconSchema.safeParse({ ...vital, value: Number.POSITIVE_INFINITY }).success).toBe(
			false
		);
	});

	it('rejects a negative measurement', () => {
		expect(BeaconSchema.safeParse({ ...vital, value: -1 }).success).toBe(false);
	});

	it('bounds every string so the endpoint cannot be used to write huge log lines', () => {
		expect(BeaconSchema.safeParse({ ...vital, path: 'x'.repeat(2049) }).success).toBe(false);
		expect(BeaconSchema.safeParse({ ...vital, sessionId: 'x'.repeat(101) }).success).toBe(false);

		const error = { kind: 'error', path: '/en', sessionId: 'session-1' };
		expect(BeaconSchema.safeParse({ ...error, message: 'x'.repeat(501) }).success).toBe(false);
		expect(
			BeaconSchema.safeParse({ ...error, message: 'boom', stack: 'x'.repeat(4001) }).success
		).toBe(false);
	});
});
