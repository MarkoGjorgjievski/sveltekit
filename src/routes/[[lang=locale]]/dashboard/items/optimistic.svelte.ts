import { SvelteMap } from 'svelte/reactivity';
import type { ItemStatus } from '$lib/schemas/item';

export interface Override {
	value: ItemStatus;
	token: number;
}

export interface Ticket {
	id: string;
	token: number;
	previous: ItemStatus | undefined;
}

/**
 * Tracks per-row optimistic status overrides, keyed by item id.
 *
 * Each call to `begin` mints a strictly increasing token for that row and hands back a `Ticket`
 * carrying it. `commit` and `rollback` only act if the row's current override still carries the
 * token they were given — otherwise a newer edit on the same row has already begun, and touching
 * the map would either erase its optimistic value (a bare `commit`) or replace it with this
 * ticket's now-stale `previous` (a bare `rollback`). That guard is what keeps two in-flight edits
 * on one row resolved by *request* order rather than by whichever response happens to land last.
 */
export function createOptimisticStatus() {
	const overrides = new SvelteMap<string, Override>();
	let counter = 0;

	return {
		get overrides(): ReadonlyMap<string, Override> {
			return overrides;
		},
		begin(id: string, next: ItemStatus): Ticket {
			const token = ++counter;
			const previous = overrides.get(id)?.value;
			overrides.set(id, { value: next, token });
			return { id, token, previous };
		},
		commit(ticket: Ticket): void {
			if (overrides.get(ticket.id)?.token !== ticket.token) return;
			overrides.delete(ticket.id);
		},
		rollback(ticket: Ticket): void {
			if (overrides.get(ticket.id)?.token !== ticket.token) return;
			if (ticket.previous === undefined) overrides.delete(ticket.id);
			else overrides.set(ticket.id, { value: ticket.previous, token: ticket.token });
		}
	};
}

export type OptimisticStatus = ReturnType<typeof createOptimisticStatus>;
