<script lang="ts">
	interface Props {
		id: string;
		label: string;
		name: string;
		type?: string;
		value?: string;
		error?: string;
		required?: boolean;
	}

	let {
		id,
		label,
		name,
		type = 'text',
		value = $bindable(''),
		error,
		required = false
	}: Props = $props();

	const errorId = $derived(`${id}-error`);
</script>

<div class="flex flex-col gap-1.5">
	<label for={id} class="text-sm font-medium text-ink">{label}</label>
	<input
		{id}
		{name}
		{type}
		{required}
		bind:value
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={error ? errorId : undefined}
		class="h-10 rounded-(--radius-control) border border-border-strong bg-surface px-3 text-sm text-ink"
	/>
	{#if error}
		<p id={errorId} class="text-sm text-danger-ink">{error}</p>
	{/if}
</div>
