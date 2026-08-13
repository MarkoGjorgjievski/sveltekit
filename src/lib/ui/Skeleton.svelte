<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children?: Snippet;
		width?: string;
		height?: string;
	}

	let { class: extra, children, width, height }: Props = $props();

	const className = $derived(
		['animate-pulse rounded-(--radius-control) bg-surface-muted motion-reduce:animate-none', extra]
			.filter(Boolean)
			.join(' ')
	);

	const style = $derived(
		[width ? `width: ${width};` : '', height ? `height: ${height};` : ''].filter(Boolean).join(' ')
	);
</script>

<div class={className} {style} aria-hidden="true">
	{#if children}{@render children()}{/if}
</div>
