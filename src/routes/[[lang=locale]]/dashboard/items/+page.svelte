<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { t } from '$lib/i18n/t';
	import Container from '$lib/ui/Container.svelte';
	import ItemsTable from './ItemsTable.svelte';
	import ItemsTableSkeleton from './ItemsTableSkeleton.svelte';
	import ErrorRegion from './ErrorRegion.svelte';
	import { reservedResultsHeightPx } from './table-metrics';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);

	// The real row count is unknowable until `data.result` resolves — that's inherent to
	// streaming, so this doesn't try to predict it. Instead it reserves the skeleton's full
	// footprint (header + perPage rows + the summary line) for the whole lifetime of this region,
	// not just while loading. A filtered/empty result and the last page of a total that doesn't
	// divide evenly by perPage both resolve to visibly shorter content than the skeleton
	// reserved; without this floor the page collapses the instant streaming finishes, which is
	// the exact layout shift streaming was meant to prevent.
	const reservedHeightPx = $derived(reservedResultsHeightPx(data.query.perPage));
</script>

<svelte:head>
	<title>{t(locale, 'dashboard.items.title')}</title>
</svelte:head>

<Container class="py-10">
	<h1 class="text-xl font-semibold text-ink">{t(locale, 'dashboard.items.title')}</h1>

	<div class="mt-6" style="min-height: {reservedHeightPx}px" data-testid="items-results-region">
		{#await data.result}
			<!-- The skeleton itself is aria-hidden (pure shape, no information), so this is the
			     only signal screen-reader users get that data is on the way. -->
			<p class="sr-only" role="status" aria-live="polite">{t(locale, 'common.loading')}</p>
			<ItemsTableSkeleton rows={data.query.perPage} />
		{:then result}
			{#if result.ok}
				{#if result.health.dropped > 0}
					<p
						class="mb-4 rounded-(--radius-card) bg-warning-surface px-4 py-3 text-sm text-warning-ink"
					>
						{t(locale, 'dashboard.items.partialData', { count: result.health.dropped })}
					</p>
				{/if}

				<ItemsTable page={result.page} query={data.query} {locale} canEdit={data.canEdit} />
			{:else}
				<ErrorRegion {locale} onretry={() => invalidate('app:items')} />
			{/if}
		{/await}
	</div>
</Container>
