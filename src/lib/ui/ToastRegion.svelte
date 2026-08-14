<script lang="ts">
	import { getContext } from 'svelte';
	import type { Locale } from '$lib/schemas/post';
	import { t } from '$lib/i18n/t';
	import { TOAST_KEY, type Toast, type ToastQueue } from './toast.svelte';

	interface Props {
		locale: Locale;
	}

	let { locale }: Props = $props();

	const toasts = getContext<ToastQueue>(TOAST_KEY);

	function toneClass(tone: Toast['tone']): string {
		return tone === 'danger'
			? 'bg-danger-surface text-danger-ink'
			: 'bg-success-surface text-success-ink';
	}
</script>

<!--
	The region itself is always in the DOM, even with zero toasts, so assistive tech has already
	registered it before any content lands there — a live region added at the same moment as its
	first announcement is frequently missed entirely.
-->
<div
	role="status"
	aria-live="polite"
	class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
>
	{#each toasts.items as toast (toast.id)}
		<div
			class={`pointer-events-auto flex items-center gap-3 rounded-(--radius-control) px-4 py-3 text-sm shadow-(--shadow-card) ${toneClass(toast.tone)}`}
		>
			<span>{toast.message}</span>
			<button
				type="button"
				class="rounded-(--radius-control) text-xs font-medium underline underline-offset-2 hover:opacity-80"
				onclick={() => toasts.dismiss(toast.id)}
			>
				{t(locale, 'toast.dismiss')}
			</button>
		</div>
	{/each}
</div>
