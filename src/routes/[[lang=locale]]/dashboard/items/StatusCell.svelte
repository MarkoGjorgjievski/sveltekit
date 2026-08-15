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

	// 403 (wrong role) and 409 (archived row) are different problems with different recourse — a
	// different account vs. unarchiving first — so they keep separate copy instead of collapsing
	// into one generic failure message. A thrown/network failure (result.type === 'error') gets a
	// third message: retry, since the request itself never landed.
	function failureMessageKey(reason: unknown): MessageKey {
		return reason === 'archived' ? 'dashboard.items.errorArchived' : 'dashboard.items.errorRole';
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
				optimistic.commit(ticket);
				toasts.push(t(locale, 'dashboard.items.saved'), 'success');
				// Only this query is invalidated — `invalidateAll()` would re-run every `load` on the
				// page for a single row's status change.
				await invalidate('app:items');
				return;
			}

			optimistic.rollback(ticket);

			if (result.type === 'failure') {
				toasts.push(t(locale, failureMessageKey(result.data?.reason)), 'danger');
			} else {
				toasts.push(t(locale, 'dashboard.items.errorNetwork'), 'danger');
			}

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
	<select
		id={`status-${item.id}`}
		name="status"
		value={shown}
		disabled={!canEdit}
		onchange={() => formEl?.requestSubmit()}
		data-testid={`status-${item.id}`}
		class="w-full appearance-none border-0 bg-transparent p-0 text-sm text-ink focus-visible:rounded-(--radius-control) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent enabled:cursor-pointer enabled:hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
	>
		{#each ITEM_STATUSES as status (status)}
			<option value={status}>{t(locale, `status.${status}`)}</option>
		{/each}
	</select>
	<!-- The onchange auto-submit above is the enhancement; without JavaScript neither `use:enhance`
	     nor onchange run, so this is the only way to submit a changed selection. `<noscript>`
	     content is never parsed into the DOM when scripting is enabled, so it adds no extra tab
	     stop or duplicate control during normal use or in these tests. -->
	<noscript><button type="submit">{t(locale, 'common.save')}</button></noscript>
</form>
