<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { t } from '$lib/i18n/t';
	import Container from '$lib/ui/Container.svelte';
	import FilterBar from './FilterBar.svelte';
	import ItemsTable from './ItemsTable.svelte';
	import ItemsTableSkeleton from './ItemsTableSkeleton.svelte';
	import ErrorRegion from './ErrorRegion.svelte';
	import { reservedResultsHeightPx } from './table-metrics';
	import type { FacetCounts } from '$lib/server/data/items.repo';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);

	// The real row count is unknowable until `data.result` resolves — that's inherent to
	// streaming, so this doesn't try to predict it. Instead it reserves the skeleton's full
	// footprint (header + perPage rows + the summary line + the pager's nav row) for the whole
	// lifetime of this region, not just while loading. A filtered/empty result and the last page
	// of a total that doesn't divide evenly by perPage both resolve to visibly shorter content
	// than the skeleton reserved; without this floor the page collapses the instant streaming
	// finishes, which is the exact layout shift streaming was meant to prevent.
	const reservedHeightPx = $derived(reservedResultsHeightPx(data.query.perPage));

	// FilterBar renders immediately, above the streamed region, built only from `data.query` —
	// which resolves synchronously with the page shell and never depends on the streamed promise.
	// Rendering it inside the `{#await}` block (as an earlier version of this page did) meant it
	// only existed once streaming finished, so the region grew by the filter bar's full height on
	// *every* load, not just short/filtered ones — exactly the shift the skeleton's height
	// reservation exists to prevent. Moving it out here removes that shift entirely, and lets the
	// user adjust filters while rows are still streaming rather than waiting.
	//
	// Its facet *counts* do still depend on the streamed result, so they arrive a tick later via
	// this effect rather than gating the whole filter bar on the promise. `current` is captured
	// per-run and compared against `data.result` before applying: without that guard, a slow
	// response for an earlier navigation could resolve after a faster one for a later navigation
	// and overwrite fresher counts with stale ones.
	let facets = $state<FacetCounts | undefined>(undefined);
	$effect(() => {
		const current = data.result;
		current.then((result) => {
			if (result.ok && data.result === current) facets = result.page.facets;
		});
	});
</script>

<svelte:head>
	<title>{t(locale, 'dashboard.items.title')}</title>
</svelte:head>

<Container class="py-10">
	<h1 class="text-xl font-semibold text-ink">{t(locale, 'dashboard.items.title')}</h1>

	<div class="mt-6">
		<FilterBar query={data.query} {facets} {locale} />
	</div>

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
