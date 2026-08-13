import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseFixture, items, posts, users, fixtureHealth } from './fixtures';

const Row = z.object({ id: z.string(), n: z.number() });

describe('parseFixture', () => {
	it('keeps valid records and drops invalid ones with a count', () => {
		const raw = [
			{ id: 'a', n: 1 },
			{ id: 'b', n: 'nope' },
			{ id: 'c', n: 3 }
		];
		const result = parseFixture(Row, raw, 'rows');
		expect(result.valid).toEqual([
			{ id: 'a', n: 1 },
			{ id: 'c', n: 3 }
		]);
		expect(result.dropped).toBe(1);
	});

	it('reports which record failed and why', () => {
		const result = parseFixture(Row, [{ id: 'b', n: 'nope' }], 'rows');
		expect(result.issues[0]).toContain('rows[0]');
		expect(result.issues[0]).toContain('n');
	});

	it('returns everything dropped when the payload is not an array', () => {
		const result = parseFixture(Row, { id: 'a', n: 1 }, 'rows');
		expect(result.valid).toEqual([]);
		expect(result.issues[0]).toContain('not an array');
	});

	it('never reports fewer dropped records than it has issues', () => {
		const notAnArray = parseFixture(Row, { id: 'a', n: 1 }, 'rows');
		expect(notAnArray.dropped).toBe(notAnArray.issues.length);

		const partial = parseFixture(
			Row,
			[
				{ id: 'a', n: 1 },
				{ id: 'b', n: 'nope' }
			],
			'rows'
		);
		expect(partial.dropped).toBe(partial.issues.length);
	});
});

describe('shipped fixtures', () => {
	it('parse cleanly at the expected scale', () => {
		expect(items).toHaveLength(220);
		expect(posts).toHaveLength(20);
		expect(users).toHaveLength(3);
		expect(fixtureHealth.dropped).toBe(0);
	});
});
