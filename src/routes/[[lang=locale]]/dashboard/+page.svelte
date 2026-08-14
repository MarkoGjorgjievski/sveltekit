<script lang="ts">
	import { t } from '$lib/i18n/t';
	import Container from '$lib/ui/Container.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
</script>

<svelte:head>
	<title>{t(locale, 'nav.dashboard')}</title>
</svelte:head>

<Container class="py-10">
	<h1 class="text-xl font-semibold text-ink">{t(locale, 'nav.dashboard')}</h1>
	{#if data.user}
		<p class="mt-2 text-ink-muted">{data.user.name} · {data.user.role}</p>
	{/if}
</Container>
