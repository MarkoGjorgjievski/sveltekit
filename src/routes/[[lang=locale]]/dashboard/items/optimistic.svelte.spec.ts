import { describe, expect, it } from 'vitest';
import { createOptimisticStatus } from './optimistic.svelte';

describe('createOptimisticStatus', () => {
	it('applies the optimistic value immediately, before any response resolves', () => {
		const optimistic = createOptimisticStatus();

		optimistic.begin('item_1', 'active');

		expect(optimistic.overrides.get('item_1')?.value).toBe('active');
	});

	it('commit clears the override, letting the row fall back to its real status, and reports that it owned the row', () => {
		const optimistic = createOptimisticStatus();

		const ticket = optimistic.begin('item_1', 'active');
		const owned = optimistic.commit(ticket);

		expect(owned).toBe(true);
		expect(optimistic.overrides.has('item_1')).toBe(false);
	});

	it('rollback clears the override the same way commit does — the display falls back to the server value, never to some other guess', () => {
		const optimistic = createOptimisticStatus();

		const ticket = optimistic.begin('item_1', 'archived');
		const owned = optimistic.rollback(ticket);

		expect(owned).toBe(true);
		expect(optimistic.overrides.has('item_1')).toBe(false);
	});

	it('keeps overrides for different rows fully independent', () => {
		const optimistic = createOptimisticStatus();

		const ticketA = optimistic.begin('item_1', 'active');
		optimistic.begin('item_2', 'paused');

		optimistic.rollback(ticketA);

		expect(optimistic.overrides.has('item_1')).toBe(false);
		expect(optimistic.overrides.get('item_2')?.value).toBe('paused');
	});

	// This is the bug the per-row token exists to prevent: two edits on the same row, where the
	// *first* request's response arrives *after* the second's. Without the token guard, the first
	// response's commit/rollback would blindly clear whatever the second edit left behind —
	// last-write-wins by response order instead of request order. Built with hand-resolved
	// deferred promises (not timers) at the component level (see StatusCell.svelte.spec.ts); here
	// at the store level the "response arriving" is just calling commit/rollback in the order under
	// test, which is what actually exercises the guard.
	it('a slow first response resolving after a fast second one does not clobber the second edit', () => {
		const optimistic = createOptimisticStatus();

		const first = optimistic.begin('item_1', 'active'); // slow request, sent first
		const second = optimistic.begin('item_1', 'paused'); // fast request, sent second

		// The second (later) edit is what should be showing right now, regardless of network order.
		expect(optimistic.overrides.get('item_1')?.value).toBe('paused');

		// The second request's response lands first and commits.
		expect(optimistic.commit(second)).toBe(true);
		expect(optimistic.overrides.has('item_1')).toBe(false); // committed = falls back to real value

		// The first request's response finally lands. Its ticket no longer owns the latest write for
		// this row (the second edit's commit already superseded it), so both commit and rollback
		// must report they didn't own the row and leave it untouched.
		expect(optimistic.commit(first)).toBe(false);
		expect(optimistic.overrides.has('item_1')).toBe(false);

		expect(optimistic.rollback(first)).toBe(false);
		expect(optimistic.overrides.has('item_1')).toBe(false);
	});

	// commit's own guard, isolated: a stale commit arriving while a *different*, newer edit is
	// still pending must not clear that newer edit's still-unconfirmed value. Unlike a scenario
	// built entirely from settled (deleted) overrides, this one has something live for an unguarded
	// `overrides.delete(...)` to wrongly destroy.
	it("a stale commit does not clear a newer edit's still-pending override", () => {
		const optimistic = createOptimisticStatus();

		const first = optimistic.begin('item_1', 'active'); // slow request, sent first
		optimistic.begin('item_1', 'paused'); // second edit begins before the first resolves

		const owned = optimistic.commit(first); // first's stale response finally arrives

		expect(owned).toBe(false);
		expect(optimistic.overrides.get('item_1')?.value).toBe('paused');
	});

	// The same guard, exercised through rollback instead of commit — both are separate public
	// methods (even though they now do the same thing internally), so both need their own proof.
	it("a stale rollback does not clear a newer edit's still-pending override", () => {
		const optimistic = createOptimisticStatus();

		const first = optimistic.begin('item_1', 'active');
		optimistic.begin('item_1', 'paused');

		const owned = optimistic.rollback(first);

		expect(owned).toBe(false);
		expect(optimistic.overrides.get('item_1')?.value).toBe('paused');
	});

	// The bug this store used to have: `rollback` restored a ticket's `previous` value, captured
	// from whatever was *currently displayed* at `begin` time — which can be another still-in-flight
	// edit's own unconfirmed guess, not server truth. Row starts at "draft". Edit A (draft -> paused)
	// begins; edit B (paused -> archived) begins before A resolves, capturing "paused" — A's guess —
	// as whatever it would have restored to. Both edits fail. There is no server value anywhere in
	// this store (it only ever tracks overrides), so the only correct outcome is that neither
	// ticket's failure leaves any trace: the row must show `item.status` (draft, server truth) once
	// StatusCell falls back to it, not "paused", which nobody chose and the server never accepted.
	it('after two edits on one row both fail — second response first, then first — the row carries no override', () => {
		const optimistic = createOptimisticStatus();

		const a = optimistic.begin('item_1', 'paused'); // draft -> paused
		const b = optimistic.begin('item_1', 'archived'); // paused -> archived, begins before A resolves

		optimistic.rollback(b); // B's failure arrives first
		optimistic.rollback(a); // A's failure arrives after — stale, but must not resurrect "paused"

		expect(optimistic.overrides.has('item_1')).toBe(false);
	});

	it('after two edits on one row both fail — first response first, then second — the row carries no override', () => {
		const optimistic = createOptimisticStatus();

		const a = optimistic.begin('item_1', 'paused');
		const b = optimistic.begin('item_1', 'archived');

		optimistic.rollback(a); // A's failure arrives first — already stale, since B owns the row
		optimistic.rollback(b); // B's failure arrives after and actually settles the row

		expect(optimistic.overrides.has('item_1')).toBe(false);
	});

	// Broader than the two above: any interleaving of commit/rollback, once every ticket for a row
	// has resolved, must leave that row with no override at all — never an orphaned entry that
	// permanently shadows `item.status` because the ticket that could have cleared it already lost
	// the token race.
	it('once every in-flight request on a row has resolved, in any mix of success and failure, the row carries no override', () => {
		const optimistic = createOptimisticStatus();

		const a = optimistic.begin('item_1', 'paused');
		const b = optimistic.begin('item_1', 'archived');

		optimistic.commit(b); // B succeeds
		optimistic.rollback(a); // A's stale failure arrives after — must not reintroduce anything

		expect(optimistic.overrides.has('item_1')).toBe(false);
	});
});
