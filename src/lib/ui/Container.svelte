<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children?: Snippet;
	}

	let { class: extra, children }: Props = $props();

	const className = $derived(['mx-auto w-full max-w-5xl px-5', extra].filter(Boolean).join(' '));
</script>

<div class={className}>
	{#if children}{@render children()}{/if}
</div>
