<script lang="ts">
	import type { Snippet } from 'svelte';
	import { variants } from './variants';

	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md';
		type?: 'button' | 'submit';
		disabled?: boolean;
		href?: string;
		class?: string;
		children: Snippet;
		onclick?: (event: MouseEvent) => void;
	}

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		disabled = false,
		href,
		class: extra,
		children,
		onclick
	}: Props = $props();

	const className = $derived(
		variants(
			'inline-flex items-center justify-center gap-2 rounded-(--radius-control) font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
			{
				variant: {
					primary: 'bg-accent text-white hover:bg-accent-ink',
					secondary: 'border border-border-strong bg-surface text-ink hover:bg-surface-muted',
					ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
					danger: 'bg-danger-ink text-white hover:opacity-90'
				},
				size: { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm' }
			},
			{ variant, size },
			extra
		)
	);
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a {href} class={className}>{@render children()}</a>
{:else}
	<button {type} {disabled} class={className} {onclick}>{@render children()}</button>
{/if}
