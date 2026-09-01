import { SvelteMap } from 'svelte/reactivity';
import type { ItemStatus } from '$lib/schemas/item';

export interface Override {
	value: ItemStatus;
	token: number;
	/**
	 * The row status the table was still displaying when the server accepted `value` — i.e. the
	 * stale value this override exists to hide until a refresh replaces it. Undefined while the
	 * request is still in flight, which is what "unconfirmed" means here.
	 */
	replaces?: ItemStatus;
}

export interface Ticket {
	id: string;
	token: number;
}

/**
 * Tracks per-row optimistic status overrides, keyed by item id.
 *
 * An override means exactly one thing: "this row has an edit in flight whose outcome the server
 * hasn't confirmed yet." It must never mean "if this fails, restore to this other guess" — an
 * earlier version captured `previous` from whatever was currently displayed at `begin` time and
 * restored `rollback` to that, but "currently displayed" can be *another still-in-flight edit's
 * own unconfirmed guess*, not server truth. Two overlapping edits on one row that both eventually
 * fail could then leave the row permanently showing a value nobody chose and the server never
 * accepted, with nothing to self-heal it. An override therefore carries no restore-to value at all:
 * dropping one lets the display fall back to `item.status` — server truth, refreshed by whichever
 * caller invalidates after commit/rollback.
 *
 * Each call to `begin` mints a strictly increasing token for that row and hands back a `Ticket`
 * carrying it. `commit` and `rollback` only touch the map if the row's current override still
 * carries the token they were given — otherwise a newer edit on the same row has already begun,
 * and clearing the override out from under it would erase that newer edit's still-unconfirmed
 * optimistic value. That guard is what keeps two in-flight edits on one row resolved by *request*
 * order rather than by whichever response happens to land last. Both methods return whether the
 * ticket actually still owned the row, so a caller can tell a superseded response (which should
 * resolve silently) from the one that actually settled the row (worth reporting to the user).
 *
 * The governing rule for *when* an override may be dropped: only at a moment when dropping it does
 * not change what is on screen. A failure satisfies that trivially — reverting is the entire point,
 * so `rollback` drops immediately. A success does not: the write is answered a whole round trip
 * before the read that refreshes the row, so dropping the override when the write returns falls
 * back to an `item.status` that is still the pre-edit value, and the cell visibly flashes the old
 * status until the refresh lands. (Measured on a real page: accepted at 837ms, refreshed rows at
 * 1124ms — a 287ms flash of the value the user just replaced.) So `commit` keeps the override and
 * records the stale value it is standing in for, and `reconcile` drops it once the table's own data
 * has moved off that value.
 */
export function createOptimisticStatus() {
	const overrides = new SvelteMap<string, Override>();
	let counter = 0;

	function owns(ticket: Ticket): boolean {
		return overrides.get(ticket.id)?.token === ticket.token;
	}

	return {
		get overrides(): ReadonlyMap<string, Override> {
			return overrides;
		},
		begin(id: string, next: ItemStatus): Ticket {
			const token = ++counter;
			overrides.set(id, { value: next, token });
			return { id, token };
		},
		/**
		 * The server accepted this edit. `showing` is the row status the table is still displaying —
		 * stale by definition, since the refresh this commit triggers has not arrived yet. The
		 * override stays in place, now marked as standing in for that stale value, until `reconcile`
		 * sees data that has moved past it.
		 */
		commit(ticket: Ticket, showing: ItemStatus): boolean {
			if (!owns(ticket)) return false;
			const current = overrides.get(ticket.id)!;
			// Nothing left to hide: the row already displays what the server stored.
			if (current.value === showing) overrides.delete(ticket.id);
			else overrides.set(ticket.id, { ...current, replaces: showing });
			return true;
		},
		rollback(ticket: Ticket): boolean {
			if (!owns(ticket)) return false;
			overrides.delete(ticket.id);
			return true;
		},
		/**
		 * Offer a row's current server truth and drop the override if it is no longer hiding
		 * anything. Three cases, and the middle one is the whole point:
		 *
		 * - Unconfirmed (no `replaces`): the request is still in flight, so the guess must stand.
		 * - `truth` is still the value we are standing in for: the refresh has not landed yet. Keep.
		 * - Anything else: the data has moved on — either to our own accepted value, or past it to
		 *   something a different session wrote. Either way the row's own status is now at least as
		 *   current as this override, so drop it and let the row speak for itself. Without that last
		 *   case a confirmed override would permanently shadow a change made elsewhere.
		 */
		reconcile(id: string, truth: ItemStatus): void {
			const current = overrides.get(id);
			if (current?.replaces === undefined) return;
			if (current.replaces === truth) return;
			overrides.delete(id);
		}
	};
}

export type OptimisticStatus = ReturnType<typeof createOptimisticStatus>;
