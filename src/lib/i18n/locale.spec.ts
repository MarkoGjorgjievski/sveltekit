import { describe, expect, it } from 'vitest';
import { localeFromParams } from './locale';

describe('localeFromParams', () => {
	it('prefers the route param', () => {
		expect(localeFromParams('de', 'en')).toBe('de');
		expect(localeFromParams('en', 'de')).toBe('en');
	});

	it('falls back when there is no segment, as on /', () => {
		expect(localeFromParams(undefined, 'de')).toBe('de');
		expect(localeFromParams('', 'en')).toBe('en');
	});

	it('ignores a segment that is not a supported locale', () => {
		// The route matcher already restricts this, so it is belt and braces — but the value ends
		// up indexing the dictionary, and an unchecked one would return undefined strings.
		expect(localeFromParams('fr', 'en')).toBe('en');
		expect(localeFromParams('EN', 'de')).toBe('de');
	});
});
