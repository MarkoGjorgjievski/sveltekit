<script lang="ts">
	import type { Snippet } from 'svelte';
	import { variants } from './variants';

	interface Props {
		/**
		 * `wide` is for the dashboard, where an eight-column table has to fit. Reading measure caps
		 * the default at 5xl, which is right for prose and far too narrow for tabular data.
		 */
		size?: 'default' | 'wide';
		class?: string;
		children?: Snippet;
	}

	let { size = 'default', class: extra, children }: Props = $props();

	// Through `variants` rather than string concatenation so the caller's `class` cannot silently
	// lose to the base: two max-w utilities in one attribute are resolved by stylesheet order, not
	// by the order they are written in.
	const className = $derived(
		variants(
			'mx-auto w-full px-5',
			{ size: { default: 'max-w-5xl', wide: 'max-w-[90rem]' } },
			{ size },
			extra
		)
	);
</script>

<div class={className}>
	{#if children}{@render children()}{/if}
</div>
