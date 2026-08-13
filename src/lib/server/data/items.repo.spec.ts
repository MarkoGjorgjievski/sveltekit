import { describe, expect, it } from 'vitest';
import { DEFAULT_QUERY } from '$lib/url/query-codec';
import { ItemMutationError, queryItems, updateItemStatus } from './items.repo';

describe('queryItems', () => {
	it('paginates without lying about the total', () => {
		const result = queryItems({ ...DEFAULT_QUERY, perPage: 25, page: 2 });
		expect(result.rows).toHaveLength(25);
		expect(result.total).toBe(220);
		expect(result.pageCount).toBe(9);
	});

	it('intersects facets rather than unioning them', () => {
		const result = queryItems({
			...DEFAULT_QUERY,
			status: ['active'],
			channel: ['email'],
			perPage: 50
		});
		expect(result.rows.length).toBeGreaterThan(0);
		expect(result.rows.every((row) => row.status === 'active' && row.channel === 'email')).toBe(
			true
		);
		expect(result.total).toBeLessThan(220);
	});

	it('sorts by a nested owner name', () => {
		const result = queryItems({ ...DEFAULT_QUERY, sort: 'owner', dir: 'asc', perPage: 50 });
		const names = result.rows.map((row) => row.owner.name);
		expect([...names].sort((a, b) => a.localeCompare(b, 'en'))).toEqual(names);
	});

	it('clamps a page beyond the end to the last page', () => {
		const result = queryItems({ ...DEFAULT_QUERY, page: 999 });
		expect(result.page).toBe(result.pageCount);
		expect(result.rows.length).toBeGreaterThan(0);
	});

	it('returns facet counts for the unfiltered dimension', () => {
		const result = queryItems({ ...DEFAULT_QUERY, status: ['active'] });
		expect(result.facets.channel.email).toBeGreaterThan(0);
	});
});

describe('updateItemStatus', () => {
	it('refuses to mutate an archived row', () => {
		const archived = queryItems({ ...DEFAULT_QUERY, status: ['archived'], perPage: 10 }).rows[0];
		expect(() => updateItemStatus(archived.id, 'active')).toThrow(ItemMutationError);
	});

	it('reports a missing row distinctly', () => {
		try {
			updateItemStatus('cmp_nope', 'active');
			expect.unreachable('should have thrown');
		} catch (error) {
			expect((error as ItemMutationError).code).toBe('not_found');
		}
	});

	it('persists a status change so a later query observes it', () => {
		const target = queryItems({ ...DEFAULT_QUERY, status: ['draft'], sort: 'name', dir: 'asc' })
			.rows[0];
		updateItemStatus(target.id, 'paused');

		const refetched = queryItems({ ...DEFAULT_QUERY, status: ['paused'], perPage: 50 }).rows;
		expect(refetched.some((row) => row.id === target.id)).toBe(true);
	});
});
