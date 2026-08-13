import { describe, expect, it } from 'vitest';
import { match } from './locale';

describe('locale matcher', () => {
	it('accepts the two supported locales', () => {
		expect(match('en')).toBe(true);
		expect(match('de')).toBe(true);
	});

	it('rejects anything else, including near-misses', () => {
		for (const candidate of ['EN', 'en-GB', 'fr', 'blog', '', 'en/', 'de.json']) {
			expect(match(candidate), candidate).toBe(false);
		}
	});
});
