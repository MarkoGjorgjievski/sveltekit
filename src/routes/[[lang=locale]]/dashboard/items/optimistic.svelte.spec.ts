import { describe, expect, it } from 'vitest';
import { createOptimisticStatus } from './optimistic.svelte';

describe('createOptimisticStatus', () => {
	it('applies the optimistic value immediately, before any response resolves', () => {
		const optimistic = createOptimisticStatus();

		optimistic.begin('item_1', 'active');

		expect(optimistic.overrides.get('item_1')?.value).toBe('active');
	});

	// The flicker this store used to cause. The write is answered a whole round trip before the read
	// that refreshes the row, so at `commit` time the table is still displaying the pre-edit value.
	// Clearing the override there — which is what commit used to do — falls back to that stale value
	// and flashes the status the user just replaced back onto the screen until the refresh lands.
	it('commit keeps the override, because the refreshed row has not arrived to replace it yet', () => {
		const optimistic = createOptimisticStatus();

		const ticket = optimistic.begin('item_1', 'active');
		const owned = optimistic.commit(ticket, 'draft'); // the row still displays "draft"

		expect(owned).toBe(true);
		expect(optimistic.overrides.get('item_1')?.value).toBe('active');
	});

	it('reconcile releases a committed override once the refreshed row carries the accepted value', () => {
		const optimistic = createOptimisticStatus();

		const ticket = optimistic.begin('item_1', 'active');
		optimistic.commit(ticket, 'draft');

		optimistic.reconcile('item_1', 'draft'); // refresh has not landed — the row is still stale
		expect(optimistic.overrides.get('item_1')?.value).toBe('active');

		optimistic.reconcile('item_1', 'active'); // refreshed rows arrive
		expect(optimistic.overrides.has('item_1')).toBe(false);
	});

	// Releasing on the *first* refresh regardless of its value would reintroduce the flicker; only
	// releasing on an exact match would let a committed override permanently shadow a change made by
	// someone else. Moving off the stale value is the condition that separates the two.
	it('reconcile releases a committed override when the row was changed elsewhere, rather than shadowing it', () => {
		const optimistic = createOptimisticStatus();

		const ticket = optimistic.begin('item_1', 'active');
		optimistic.commit(ticket, 'draft');

		optimistic.reconcile('item_1', 'archived'); // a different session got there first

		expect(optimistic.overrides.has('item_1')).toBe(false);
	});

	it('reconcile leaves an in-flight override alone — an unanswered guess is the whole point of one', () => {
		const optimistic = createOptimisticStatus();

		optimistic.begin('item_1', 'active');
		optimistic.reconcile('item_1', 'draft');

		expect(optimistic.overrides.get('item_1')?.value).toBe('active');
	});

	it('commit drops the override outright when the row already displays what the server stored', () => {
		const optimistic = createOptimisticStatus();

		const ticket = optimistic.begin('item_1', 'active');
		const owned = optimistic.commit(ticket, 'active');

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

		// The second request's response lands first and commits. The override stays — the refreshed
		// row has not arrived yet — now standing in for "draft", the value still on screen.
		expect(optimistic.commit(second, 'draft')).toBe(true);
		expect(optimistic.overrides.get('item_1')?.value).toBe('paused');

		// The first request's response finally lands. Its ticket no longer owns the latest write for
		// this row (the second edit's commit already superseded it), so both commit and rollback
		// must report they didn't own the row and leave the second edit's value untouched.
		expect(optimistic.commit(first, 'draft')).toBe(false);
		expect(optimistic.overrides.get('item_1')?.value).toBe('paused');

		expect(optimistic.rollback(first)).toBe(false);
		expect(optimistic.overrides.get('item_1')?.value).toBe('paused');

		// And the row settles to exactly one value once its refresh arrives.
		optimistic.reconcile('item_1', 'paused');
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

		const owned = optimistic.commit(first, 'draft'); // first's stale response finally arrives

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

		optimistic.commit(b, 'draft'); // B succeeds; its value is held until the refresh lands
		optimistic.rollback(a); // A's stale failure arrives after — must not reintroduce anything

		expect(optimistic.overrides.get('item_1')?.value).toBe('archived');

		optimistic.reconcile('item_1', 'archived'); // the refresh B asked for
		expect(optimistic.overrides.has('item_1')).toBe(false);
	});
});
