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
	// the effect below rather than gating the whole filter bar on the promise.
	let facets = $state<FacetCounts | undefined>(undefined);

	type ItemsResult = Awaited<typeof data.result>;

	// `data.result` is a NEW promise on every load: a same-query refresh after an inline edit, a
	// sort, a page change, and every debounced keystroke in the name filter. Awaiting it directly
	// re-entered the `{#await}` pending branch each time, which unmounts the resolved branch — so
	// the table the user was working in was replaced by the skeleton for the whole round trip.
	//
	// For an edit that meant losing keyboard focus in the row and discarding ItemsTable's
	// optimistic overrides with the component instance. For search-as-you-type it meant the results
	// blinking away on every keystroke burst, which reads as the page fighting the person typing.
	//
	// So the awaited promise is never swapped. It seeds the first paint — including the server
	// render, where no effect has run yet and `{#await}` must already have a promise to stream
	// against — and every load after that resolves into `resolved`, which the resolved branch
	// prefers. The table is patched in place and never unmounts.
	//
	// svelte-ignore state_referenced_locally
	let awaited = $state.raw(data.result);
	let resolved = $state.raw<ItemsResult | undefined>(undefined);

	// True while a newer load is in flight and there is already something on screen to keep. The
	// region is marked aria-busy and dimmed rather than emptied: stale-but-labelled beats blank.
	let pending = $state(false);

	$effect(() => {
		const current = data.result;

		// Only once something is on screen. On the very first load there is nothing to keep, and
		// the skeleton — which is what streaming exists to show — is the right answer.
		if (resolved !== undefined) pending = true;

		// `current` is captured per-run and compared against `data.result` before applying: without
		// that guard, a slow response for an earlier navigation could resolve after a faster one for
		// a later navigation and overwrite fresher rows and counts with stale ones.
		current.then((result) => {
			if (data.result !== current) return;
			if (result.ok) facets = result.page.facets;
			resolved = result;
			pending = false;
		});
	});
</script>

<svelte:head>
	<title>{t(locale, 'dashboard.items.title')}</title>
</svelte:head>

<Container size="wide" class="py-10">
	<h1 class="text-xl font-semibold text-ink">{t(locale, 'dashboard.items.title')}</h1>

	<div class="mt-6">
		<FilterBar query={data.query} {facets} {locale} />
	</div>

	<div class="mt-6" style="min-height: {reservedHeightPx}px" data-testid="items-results-region">
		{#await awaited}
			<!-- The skeleton itself is aria-hidden (pure shape, no information), so this is the
			     only signal screen-reader users get that data is on the way. -->
			<p class="sr-only" role="status" aria-live="polite">{t(locale, 'common.loading')}</p>
			<ItemsTableSkeleton rows={data.query.perPage} />
		{:then initial}
			<!-- `resolved` is the newest load of any query; `initial` is only the streamed first
			     paint. Preferring the former is what lets every later load update the table in place
			     instead of tearing the resolved branch down and rebuilding it.

			     While a newer load is in flight the previous rows stay, dimmed and marked aria-busy.
			     Blanking them on each keystroke is what made the name filter feel like it was
			     fighting the person typing. -->
			{@const result = resolved ?? initial}
			<div aria-busy={pending} class="transition-opacity duration-150" class:opacity-60={pending}>
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
			</div>
		{/await}
	</div>
</Container>
