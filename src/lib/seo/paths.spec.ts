import { describe, expect, it } from 'vitest';
import { swapLocale } from './paths';

describe('swapLocale', () => {
	it('swaps only a leading locale segment', () => {
		expect(swapLocale('/en/blog', 'de')).toBe('/de/blog');
		expect(swapLocale('/de', 'en')).toBe('/en');
		expect(swapLocale('/design/blog', 'de')).toBe('/design/blog');
		expect(swapLocale('/entry-level-guide', 'de')).toBe('/entry-level-guide');
	});
});
