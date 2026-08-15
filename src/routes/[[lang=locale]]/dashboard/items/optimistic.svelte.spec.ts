import { describe, expect, it } from 'vitest';
import { createOptimisticStatus } from './optimistic.svelte';

describe('createOptimisticStatus', () => {
	it('applies the optimistic value immediately, before any response resolves', () => {
		const optimistic = createOptimisticStatus();

		optimistic.begin('item_1', 'active');

		expect(optimistic.overrides.get('item_1')?.value).toBe('active');
	});

	it('commit clears the override, letting the row fall back to its real status', () => {
		const optimistic = createOptimisticStatus();

		const ticket = optimistic.begin('item_1', 'active');
		optimistic.commit(ticket);

		expect(optimistic.overrides.has('item_1')).toBe(false);
	});

	it('rollback restores the value that was showing before this edit began', () => {
		const optimistic = createOptimisticStatus();

		// A prior successful edit already committed, so nothing is overridden — the row is just
		// showing its real, persisted status at this point.
		optimistic.rollback(optimistic.begin('item_1', 'paused'));
		expect(optimistic.overrides.has('item_1')).toBe(false);

		// Now begin again on top of no override, and roll back — should end up back at "no
		// override" (there was nothing to restore to), not stuck on the failed value.
		const ticket = optimistic.begin('item_1', 'archived');
		expect(optimistic.overrides.get('item_1')?.value).toBe('archived');
		optimistic.rollback(ticket);
		expect(optimistic.overrides.has('item_1')).toBe(false);
	});

	it('rollback restores an earlier still-pending override, not the real status, when one exists', () => {
		const optimistic = createOptimisticStatus();

		optimistic.begin('item_1', 'active');
		// A second edit begins before the first has been committed or rolled back — its `previous`
		// is the first edit's optimistic value, not the row's original real status.
		const second = optimistic.begin('item_1', 'paused');
		expect(second.previous).toBe('active');

		optimistic.rollback(second);
		expect(optimistic.overrides.get('item_1')?.value).toBe('active');
	});

	// This is the bug the per-row token exists to prevent: two edits on the same row, where the
	// *first* request's response arrives *after* the second's. Without the token guard, the first
	// response's commit/rollback would blindly overwrite whatever the second edit left behind —
	// last-write-wins by response order instead of request order. Built with hand-resolved
	// deferred promises (not timers), so "the first response arrives after the second" is asserted
	// by construction, not by hoping a timer fires in the right order.
	it('a slow first response resolving after a fast second one does not clobber the second edit', () => {
		const optimistic = createOptimisticStatus();

		const first = optimistic.begin('item_1', 'active'); // slow request, sent first
		const second = optimistic.begin('item_1', 'paused'); // fast request, sent second

		// The second (later) edit is what should be showing right now, regardless of network order.
		expect(optimistic.overrides.get('item_1')?.value).toBe('paused');

		// The second request's response lands first and commits.
		optimistic.commit(second);
		expect(optimistic.overrides.has('item_1')).toBe(false); // committed = falls back to real value

		// The first request's response finally lands. Its ticket no longer owns the latest write for
		// this row (the second edit's commit already superseded it), so both commit and rollback
		// must no-op rather than reintroduing the stale "active" value or reverting to "before
		// either edit ran".
		optimistic.commit(first);
		expect(optimistic.overrides.has('item_1')).toBe(false);

		optimistic.rollback(first);
		expect(optimistic.overrides.has('item_1')).toBe(false);
	});

	it('a stale rollback arriving after a newer edit already rolled back does not overwrite it', () => {
		const optimistic = createOptimisticStatus();

		const first = optimistic.begin('item_1', 'active'); // slow request, sent first
		const second = optimistic.begin('item_1', 'paused'); // fast request, sent second

		// The second (newer) edit fails first and rolls back — it restores the row to what was
		// showing before *it* began, which is the first edit's still-pending optimistic value, not
		// the row's original real status (the first edit hasn't settled yet).
		optimistic.rollback(second);
		expect(optimistic.overrides.get('item_1')?.value).toBe('active');

		// The first request's own failure response finally arrives. Its ticket no longer owns the
		// latest write (rollback(second) already advanced the row past it), so this must no-op
		// rather than reapplying "active" a second time via a different, now-stale code path.
		optimistic.rollback(first);
		expect(optimistic.overrides.get('item_1')?.value).toBe('active');
	});

	// commit's own guard, isolated from rollback's: deleting an already-absent key looks identical
	// whether or not commit checked the token first, so a race test built entirely out of deletes
	// (like the two above) can pass even with commit's guard removed. This scenario leaves a *live,
	// different-token* override in place (via rollback(second)) before the stale commit(first)
	// arrives, so an unguarded `overrides.delete(...)` has something real to wrongly destroy.
	it('a stale commit arriving after a newer edit rolled back does not clear the value it restored', () => {
		const optimistic = createOptimisticStatus();

		const first = optimistic.begin('item_1', 'active'); // slow request, sent first
		const second = optimistic.begin('item_1', 'paused'); // fast request, sent second

		// second fails first and rolls back, restoring "active" (first's still-pending value) — the
		// override is still live, just now owned by second's token.
		optimistic.rollback(second);
		expect(optimistic.overrides.get('item_1')?.value).toBe('active');

		// first's own (stale) success response finally arrives. Its ticket no longer owns the
		// latest write, so this must no-op rather than deleting the override rollback(second) just
		// restored — which would incorrectly fall the row back to its original real status instead
		// of the "active" value that is actually correct right now.
		optimistic.commit(first);
		expect(optimistic.overrides.get('item_1')?.value).toBe('active');
	});

	it('keeps overrides for different rows fully independent', () => {
		const optimistic = createOptimisticStatus();

		const ticketA = optimistic.begin('item_1', 'active');
		optimistic.begin('item_2', 'paused');

		optimistic.rollback(ticketA);

		expect(optimistic.overrides.has('item_1')).toBe(false);
		expect(optimistic.overrides.get('item_2')?.value).toBe('paused');
	});
});
