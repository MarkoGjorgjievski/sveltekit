import { SvelteMap } from 'svelte/reactivity';
import type { ItemStatus } from '$lib/schemas/item';

export interface Override {
	value: ItemStatus;
	token: number;
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
 * accepted, with nothing to self-heal it. Once a request resolves — success or failure — its
 * override simply goes away, and the display falls back to `item.status`: server truth, refreshed
 * by whichever caller invalidates after commit/rollback.
 *
 * Each call to `begin` mints a strictly increasing token for that row and hands back a `Ticket`
 * carrying it. `commit` and `rollback` only touch the map if the row's current override still
 * carries the token they were given — otherwise a newer edit on the same row has already begun,
 * and clearing the override out from under it would erase that newer edit's still-unconfirmed
 * optimistic value. That guard is what keeps two in-flight edits on one row resolved by *request*
 * order rather than by whichever response happens to land last. Both methods return whether the
 * ticket actually still owned the row, so a caller can tell a superseded response (which should
 * resolve silently) from the one that actually settled the row (worth reporting to the user).
 */
export function createOptimisticStatus() {
	const overrides = new SvelteMap<string, Override>();
	let counter = 0;

	function settle(ticket: Ticket): boolean {
		if (overrides.get(ticket.id)?.token !== ticket.token) return false;
		overrides.delete(ticket.id);
		return true;
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
		commit(ticket: Ticket): boolean {
			return settle(ticket);
		},
		rollback(ticket: Ticket): boolean {
			return settle(ticket);
		}
	};
}

export type OptimisticStatus = ReturnType<typeof createOptimisticStatus>;
