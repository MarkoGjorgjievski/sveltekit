import { describe, expect, it } from 'vitest';
import { ItemQuerySchema } from '$lib/schemas/query';
import { DEFAULT_QUERY, parseQuery, toSearchParams, type ItemQuery } from './query-codec';

describe('parseQuery', () => {
	it('round-trips a fully populated query', () => {
		const query: ItemQuery = {
			q: 'summer',
			status: ['active', 'paused'],
			channel: ['email'],
			tags: ['design'],
			sort: 'budget',
			dir: 'asc',
			page: 3,
			perPage: 50
		};
		expect(parseQuery(toSearchParams(query))).toEqual(query);
	});

	it('falls back to defaults for an invalid sort key instead of throwing', () => {
		const parsed = parseQuery(new URLSearchParams('sort=__proto__&dir=sideways'));
		expect(parsed.sort).toBe(DEFAULT_QUERY.sort);
		expect(parsed.dir).toBe(DEFAULT_QUERY.dir);
	});

	it('clamps a nonsense page to 1', () => {
		expect(parseQuery(new URLSearchParams('page=-4')).page).toBe(1);
		expect(parseQuery(new URLSearchParams('page=abc')).page).toBe(1);
	});

	it('drops unknown facet values rather than trusting them', () => {
		expect(parseQuery(new URLSearchParams('status=active&status=bogus')).status).toEqual([
			'active'
		]);
	});

	it('survives hostile input without throwing', () => {
		const hostile = new URLSearchParams(
			'sort=__proto__&dir=constructor&page=1e999&perPage=NaN&status=__proto__&q='
		);
		expect(() => parseQuery(hostile)).not.toThrow();
		const parsed = parseQuery(hostile);
		expect(parsed.sort).toBe(DEFAULT_QUERY.sort);
		expect(parsed.status).toEqual([]);
		expect(parsed.perPage).toBe(DEFAULT_QUERY.perPage);
	});

	it('serialises the tags facet as a singular tag parameter', () => {
		const params = toSearchParams({ ...DEFAULT_QUERY, tags: ['design', 'ai'] });
		expect(params.getAll('tag')).toEqual(['design', 'ai']);
		expect(params.getAll('tags')).toEqual([]);
		expect(parseQuery(params).tags).toEqual(['design', 'ai']);
	});
});

describe('toSearchParams', () => {
	it('omits defaults so a clean state produces a clean URL', () => {
		expect(toSearchParams(DEFAULT_QUERY).toString()).toBe('');
	});

	it('emits repeated keys for multi-value facets', () => {
		const params = toSearchParams({ ...DEFAULT_QUERY, status: ['active', 'draft'] });
		expect(params.getAll('status')).toEqual(['active', 'draft']);
	});

	it('takes its defaults from the schema, not a second copy', () => {
		expect(DEFAULT_QUERY).toEqual(ItemQuerySchema.parse({}));
	});
});
