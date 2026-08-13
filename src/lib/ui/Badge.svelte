<script lang="ts">
	import type { Snippet } from 'svelte';
	import { variants } from './variants';

	interface Props {
		tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
		children: Snippet;
	}

	let { tone = 'neutral', children }: Props = $props();

	const className = $derived(
		variants(
			'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
			{
				tone: {
					neutral: 'bg-surface-muted text-ink-muted',
					accent: 'bg-accent-surface text-accent-ink',
					success: 'bg-success-surface text-success-ink',
					warning: 'bg-warning-surface text-warning-ink',
					danger: 'bg-danger-surface text-danger-ink'
				}
			},
			{ tone }
		)
	);
</script>

<span class={className}>{@render children()}</span>
