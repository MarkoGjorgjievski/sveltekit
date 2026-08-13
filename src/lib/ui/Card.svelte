<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children?: Snippet;
	}

	let { class: extra, children }: Props = $props();

	const className = $derived(
		['rounded-(--radius-card) border border-border bg-surface p-6 shadow-(--shadow-card)', extra]
			.filter(Boolean)
			.join(' ')
	);
</script>

<div class={className}>
	{#if children}{@render children()}{/if}
</div>
