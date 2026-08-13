<script lang="ts">
	import type { Snippet } from 'svelte';
	import { variants } from './variants';

	interface Props {
		as?: 'h1' | 'h2' | 'h3' | 'p';
		class?: string;
		children?: Snippet;
	}

	let { as = 'p', class: extra, children }: Props = $props();

	const className = $derived(
		variants(
			'text-ink',
			{
				as: {
					h1: 'text-3xl font-bold tracking-tight',
					h2: 'text-2xl font-semibold tracking-tight',
					h3: 'text-xl font-semibold',
					p: 'text-base font-normal'
				}
			},
			{ as },
			extra
		)
	);
</script>

<svelte:element this={as} class={className}>
	{#if children}{@render children()}{/if}
</svelte:element>
