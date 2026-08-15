<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { t } from '$lib/i18n/t';
	import type { ItemStatus } from '$lib/schemas/item';
	import Container from '$lib/ui/Container.svelte';
	import Badge from '$lib/ui/Badge.svelte';
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

	// Lifecycle order, not severity — a neutral tone for the early/inactive states keeps "active"
	// the one status that reads as attention-grabbing at a glance.
	const STATUS_TONE = {
		draft: 'neutral',
		scheduled: 'accent',
		active: 'success',
		paused: 'warning',
		completed: 'neutral',
		archived: 'neutral'
	} as const satisfies Record<ItemStatus, 'neutral' | 'accent' | 'success' | 'warning'>;
</script>

<svelte:head>
	<title>{t(locale, 'dashboard.items.title')}</title>
</svelte:head>

<Container class="py-10">
	<h1 class="text-xl font-semibold text-ink">{t(locale, 'dashboard.items.title')}</h1>

	<div class="mt-6" style="min-height: {reservedHeightPx}px">
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

				{#if result.page.rows.length === 0}
					<p
						class="rounded-(--radius-card) border border-border bg-surface px-4 py-8 text-center text-sm text-ink-muted"
					>
						{t(locale, 'dashboard.items.empty')}
					</p>
				{:else}
					<!-- Plain table for now; Task 19 extracts this into ItemsTable and adds
					     sortable headers, the facet bar, and the pager. -->
					<table class="w-full table-fixed border-collapse">
						<caption class="sr-only">{t(locale, 'dashboard.items.title')}</caption>
						<colgroup>
							<col class="w-[70%]" />
							<col class="w-[30%]" />
						</colgroup>
						<thead>
							<tr class="border-b border-border">
								<th scope="col" class="px-4 py-3 text-left text-sm font-medium text-ink-muted">
									{t(locale, 'dashboard.items.column.name')}
								</th>
								<th scope="col" class="px-4 py-3 text-left text-sm font-medium text-ink-muted">
									{t(locale, 'dashboard.items.column.status')}
								</th>
							</tr>
						</thead>
						<tbody>
							{#each result.page.rows as item (item.id)}
								<tr class="border-b border-border">
									<th scope="row" class="px-4 py-3 text-left text-sm font-normal text-ink">
										{item.name}
									</th>
									<td class="px-4 py-3">
										<Badge tone={STATUS_TONE[item.status]}
											>{t(locale, `status.${item.status}`)}</Badge
										>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<p class="mt-3 text-sm text-ink-muted">
						{t(locale, 'dashboard.items.showing', {
							from: (result.page.page - 1) * data.query.perPage + 1,
							to: Math.min(result.page.page * data.query.perPage, result.page.total),
							total: result.page.total
						})}
					</p>
				{/if}
			{:else}
				<ErrorRegion {locale} onretry={() => invalidate('app:items')} />
			{/if}
		{/await}
	</div>
</Container>
