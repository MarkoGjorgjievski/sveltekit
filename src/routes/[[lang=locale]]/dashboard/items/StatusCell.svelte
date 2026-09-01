<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { getContext } from 'svelte';
	import { ITEM_STATUSES, type Item, type ItemStatus } from '$lib/schemas/item';
	import { TOAST_KEY, type ToastQueue } from '$lib/ui/toast.svelte';
	import { t, type MessageKey } from '$lib/i18n/t';
	import type { Locale } from '$lib/schemas/post';
	import type { OptimisticStatus } from './optimistic.svelte';

	interface Props {
		item: Item;
		locale: Locale;
		canEdit: boolean;
		optimistic: OptimisticStatus;
	}

	let { item, locale, canEdit, optimistic }: Props = $props();
	const toasts = getContext<ToastQueue>(TOAST_KEY);

	// Falls back to the row's real status once nothing in the optimistic map owns this id anymore
	// (no edit in flight, or the last one settled) — `optimistic.overrides` is a SvelteMap, so this
	// stays reactive to every begin/commit/rollback without this component reaching into the store's
	// internals.
	const shown = $derived(optimistic.overrides.get(item.id)?.value ?? item.status);

	let formEl = $state<HTMLFormElement | null>(null);

	// Four reasons, four messages: 403 (wrong role), 409 (archived row), 400 (invalid status —
	// unreachable from this form's own controls, but reachable if the request is tampered with),
	// and 404 (row deleted by another session between page load and this submit) are all different
	// problems with different recourse. Collapsing any pair into one message misleads the user
	// about which of them applies — a row deleted elsewhere is not a permissions problem, and
	// showing "your role cannot edit campaigns" for it is actively wrong. `result.type === 'error'`
	// (a thrown or network failure) gets a fifth message via the `else` branch below: retry, since
	// the request itself never landed and none of these server-returned reasons apply.
	function failureMessageKey(reason: unknown): MessageKey {
		switch (reason) {
			case 'role':
				return 'dashboard.items.errorRole';
			case 'archived':
				return 'dashboard.items.errorArchived';
			case 'invalid':
				return 'dashboard.items.errorInvalid';
			case 'missing':
				return 'dashboard.items.errorMissing';
			default:
				return 'dashboard.items.errorNetwork';
		}
	}
</script>

<form
	bind:this={formEl}
	method="POST"
	action="?/updateStatus"
	use:enhance={({ formData }) => {
		const next = String(formData.get('status')) as ItemStatus;
		const ticket = optimistic.begin(item.id, next);

		return async ({ result, update }) => {
			if (result.type === 'success') {
				// `commit` returns false if a newer edit on this row has already begun — that edit's
				// own optimistic value is still live and this response no longer speaks for the row,
				// so this one resolves silently rather than reporting success for a value the row no
				// longer shows.
				//
				// `item.status` is handed over as the stale value the override is now standing in
				// for. The write has been accepted but the *read* that refreshes this row is only
				// starting below, so `item.status` is still the pre-edit value for another round
				// trip; releasing the override here would flash it back on screen. ItemsTable
				// releases the override when the refreshed rows actually arrive.
				const owned = optimistic.commit(ticket, item.status);
				if (owned) toasts.push(t(locale, 'dashboard.items.saved'), 'success');
				// Only this query is invalidated — `invalidateAll()` would re-run every `load` on the
				// page for a single row's status change. Invalidated even when superseded: the server
				// really did apply this change, so cached data should still catch up with it.
				await invalidate('app:items');
				return;
			}

			// Same ownership check as commit, for the same reason: a superseded ticket's failure is
			// not news to the user, who has already moved on to a different edit.
			const owned = optimistic.rollback(ticket);
			if (owned) {
				if (result.type === 'failure') {
					toasts.push(t(locale, failureMessageKey(result.data?.reason)), 'danger');
				} else {
					toasts.push(t(locale, 'dashboard.items.errorNetwork'), 'danger');
				}
			}

			// Re-reads the row from the server rather than trusting the `item` prop as it was when
			// this component last rendered — a failed request is exactly the moment local state and
			// server truth can have drifted (someone else archived or deleted the row, for instance).
			await invalidate('app:items');

			// The optimistic value has already been rolled back above; this just resyncs the form's
			// own bookkeeping (e.g. re-enables it after enhance's implicit disable) without SvelteKit
			// re-applying `result` a second time or invalidating anything itself.
			await update({ reset: false, invalidateAll: false });
		};
	}}
>
	<input type="hidden" name="id" value={item.id} />
	<label class="sr-only" for={`status-${item.id}`}>
		{t(locale, 'dashboard.items.editStatus', { name: item.name })}
	</label>
	<!--
		Bordered rather than borderless. Styled as text it read as a label, so the one interactive
		control in the table looked like data — and a viewer could not tell that a disabled control
		was even a control. The chevron is the affordance a native select loses to appearance-none.

		The height here is what ROW_HEIGHT_PX in table-metrics.ts reserves for. Changing h-8 or the
		cell padding changes the real row height, the skeleton under-reserves, and the layout shift
		streaming exists to avoid comes back — which is why a test measures the rendered height.
	-->
	<div class="relative">
		<select
			id={`status-${item.id}`}
			name="status"
			value={shown}
			disabled={!canEdit}
			onchange={() => formEl?.requestSubmit()}
			data-testid={`status-${item.id}`}
			class="block h-8 w-full appearance-none rounded-(--radius-control) border border-border-strong bg-surface pr-7 pl-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent enabled:cursor-pointer enabled:hover:border-accent disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
		>
			{#each ITEM_STATUSES as status (status)}
				<option value={status}>{t(locale, `status.${status}`)}</option>
			{/each}
		</select>
		<svg
			aria-hidden="true"
			viewBox="0 0 20 20"
			class="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-ink-muted"
		>
			<path
				fill="currentColor"
				d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
			/>
		</svg>
	</div>
	<!-- The onchange auto-submit above is the enhancement; without JavaScript neither `use:enhance`
	     nor onchange run, so this is the only way to submit a changed selection. `<noscript>`
	     content is never parsed into the DOM when scripting is enabled, so it adds no extra tab
	     stop or duplicate control during normal use or in these tests. -->
	<noscript><button type="submit">{t(locale, 'common.save')}</button></noscript>
</form>
