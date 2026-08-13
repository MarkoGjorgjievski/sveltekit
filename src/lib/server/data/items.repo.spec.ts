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

	it('counts each facet excluding only its own selection', () => {
		const selected = queryItems({ ...DEFAULT_QUERY, status: ['active'], perPage: 50 });

		// The channel counts must respect the active status filter.
		expect(selected.facets.channel.email).toBe(15);
		expect(selected.facets.channel.social).toBe(20);

		// The status counts must NOT be narrowed by the status selection itself,
		// so the user can still see what widening to another status would give.
		expect(selected.facets.status.active).toBe(72);
		expect(selected.facets.status.draft).toBe(23);
	});

	it('a facet count equals the total you get by selecting it', () => {
		const selected = queryItems({ ...DEFAULT_QUERY, status: ['active'], perPage: 50 });

		for (const channel of ['email', 'social', 'web', 'push', 'sms'] as const) {
			const claimed = selected.facets.channel[channel];
			const actual = queryItems({
				...DEFAULT_QUERY,
				status: ['active'],
				channel: [channel]
			}).total;
			expect(claimed, `channel ${channel}`).toBe(actual);
		}
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
