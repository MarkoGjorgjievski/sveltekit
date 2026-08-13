import { describe, expect, it } from 'vitest';
import { t } from './t';
import { formatCurrency, formatDate, formatPercent } from './format';
import { dictionaries, type MessageKey } from './dict';

describe('t', () => {
	it('returns the string for a locale', () => {
		expect(t('en', 'nav.home')).toBe('Home');
		expect(t('de', 'nav.home')).toBe('Start');
	});

	it('interpolates named placeholders', () => {
		expect(t('en', 'blog.readingTime', { minutes: 3 })).toBe('3 min read');
		expect(t('en', 'search.results', { count: 2, query: 'inp' })).toBe('2 results for "inp"');
	});

	it('leaves an unmatched placeholder visible rather than printing undefined', () => {
		expect(t('en', 'blog.readingTime', {})).toBe('{minutes} min read');
	});

	it('has full key parity between locales', () => {
		expect(Object.keys(dictionaries.de).sort()).toEqual(Object.keys(dictionaries.en).sort());
	});

	it('adds keys without overwriting any the assignment provided', async () => {
		const baseEn = (await import('$lib/fixtures/i18n.en.json')).default;
		const additionsEn = (await import('./additions.en.json')).default;

		const collisions = Object.keys(additionsEn).filter((key) => key in baseEn);
		expect(collisions).toEqual([]);

		for (const [key, value] of Object.entries(baseEn)) {
			expect(dictionaries.en[key as MessageKey]).toBe(value);
		}
	});
});

describe('Intl formatters', () => {
	it('formats dates per locale', () => {
		expect(formatDate('2026-05-31T00:00:00Z', 'en')).toBe('31 May 2026');
		expect(formatDate('2026-05-31T00:00:00Z', 'de')).toBe('31. Mai 2026');
	});

	it('formats currency per locale', () => {
		expect(formatCurrency(2500, 'en')).toContain('2,500');
		expect(formatCurrency(2500, 'de')).toContain('2.500');
	});

	it('formats a ratio as a percentage', () => {
		expect(formatPercent(0.0537, 'en')).toBe('5.37%');
	});
});
