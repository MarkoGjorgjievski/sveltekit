import { describe, expect, it } from 'vitest';
import { hashUnitInterval, shouldSample } from './sampling';

describe('hashUnitInterval', () => {
	it('stays inside [0, 1)', () => {
		const values = ['', 'a', 'session-1', crypto.randomUUID(), 'x'.repeat(500)];
		for (const value of values) {
			const hash = hashUnitInterval(value);
			expect(hash).toBeGreaterThanOrEqual(0);
			expect(hash).toBeLessThan(1);
		}
	});

	it('returns the same value for the same input', () => {
		expect(hashUnitInterval('session-abc')).toBe(hashUnitInterval('session-abc'));
	});

	it('separates inputs that differ by one character', () => {
		expect(hashUnitInterval('session-a')).not.toBe(hashUnitInterval('session-b'));
	});

	it('spreads ids across the interval near the requested rate', () => {
		// The guard that matters: a hash biased toward one end would sample ~everyone or ~no one
		// while still looking deterministic. 2000 ids at 10% should land near 200.
		const ids = Array.from({ length: 2000 }, (_, index) => `session-${index}`);
		const sampled = ids.filter((id) => hashUnitInterval(id) < 0.1).length;
		expect(sampled).toBeGreaterThan(140);
		expect(sampled).toBeLessThan(260);
	});
});

describe('shouldSample', () => {
	it('is stable for a session across repeated calls', () => {
		const id = 'session-stable';
		const first = shouldSample(id, 0.5, '');
		for (let attempt = 0; attempt < 25; attempt++) {
			expect(shouldSample(id, 0.5, '')).toBe(first);
		}
	});

	it('includes everyone at a rate of 1 and nobody at 0', () => {
		expect(shouldSample('session-x', 1, '')).toBe(true);
		expect(shouldSample('session-x', 0, '')).toBe(false);
	});

	it('forces inclusion when ?rum is present, whatever the rate', () => {
		expect(shouldSample('session-x', 0, '?rum')).toBe(true);
		expect(shouldSample('session-x', 0, '?rum=1')).toBe(true);
		expect(shouldSample('session-x', 0, '?other=1')).toBe(false);
	});
});
