<script lang="ts">
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		id: string;
		label: string;
		name: string;
		value?: string;
		error?: string;
		required?: boolean;
		options: Option[];
	}

	let {
		id,
		label,
		name,
		value = $bindable(''),
		error,
		required = false,
		options
	}: Props = $props();

	const errorId = $derived(`${id}-error`);
</script>

<div class="flex flex-col gap-1.5">
	<label for={id} class="text-sm font-medium text-ink">{label}</label>
	<select
		{id}
		{name}
		{required}
		bind:value
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={error ? errorId : undefined}
		class="h-10 rounded-(--radius-control) border border-border-strong bg-surface px-3 text-sm text-ink"
	>
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
	{#if error}
		<p id={errorId} class="text-sm text-danger-ink">{error}</p>
	{/if}
</div>
