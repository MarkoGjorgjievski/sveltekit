<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Locale } from '$lib/schemas/post';
	import type { SortKey } from '$lib/schemas/query';
	import { toSearchParams, type ItemQuery } from '$lib/url/query-codec';
	import type { ItemPage } from '$lib/server/data/items.repo';
	import type { MessageKey } from '$lib/i18n/t';
	import { t } from '$lib/i18n/t';
	import { formatCurrency, formatDate, formatPercent } from '$lib/i18n/format';
	import Pager from './Pager.svelte';
	import StatusCell from './StatusCell.svelte';
	import { createOptimisticStatus } from './optimistic.svelte';

	interface Props {
		page: ItemPage;
		query: ItemQuery;
		locale: Locale;
		// Read by the status column below, which disables its <select> for a viewer instead of
		// hiding it — the control stays visible (and its disabled state inspectable) so the
		// authorization boundary is something a user can see, not just something the server
		// enforces silently.
		canEdit: boolean;
	}

	let { page, query, locale, canEdit }: Props = $props();

	// One store per table instance, shared across every row's StatusCell — overrides are keyed by
	// item id, so rows never collide, and the instance survives sort/filter re-renders of this same
	// component rather than resetting mid-edit.
	const optimistic = createOptimisticStatus();

	const COLUMNS: { key: SortKey; label: MessageKey; numeric: boolean }[] = [
		{ key: 'name', label: 'dashboard.items.column.name', numeric: false },
		{ key: 'status', label: 'dashboard.items.column.status', numeric: false },
		{ key: 'channel', label: 'dashboard.items.column.channel', numeric: false },
		{ key: 'owner', label: 'dashboard.items.column.owner', numeric: false },
		{ key: 'budget', label: 'dashboard.items.column.budget', numeric: true },
		{ key: 'spent', label: 'dashboard.items.column.spent', numeric: true },
		{ key: 'ctr', label: 'dashboard.items.column.ctr', numeric: true },
		{ key: 'updatedAt', label: 'dashboard.items.column.updated', numeric: true }
	];

	// Clicking the active column flips direction; a new column starts ascending.
	function nextDir(key: SortKey) {
		return query.sort === key && query.dir === 'asc' ? 'desc' : 'asc';
	}
	function arrow(key: SortKey) {
		if (query.sort !== key) return '';
		return query.dir === 'asc' ? '▲' : '▼';
	}
	// Sorting resets page to 1: staying on page 7 of a re-sorted list shows an arbitrary slice.
	// toSearchParams already omits `page` when it equals the default (1), so a sort onto the
	// server's default order produces a href with no page param at all.
	function sortHref(key: SortKey) {
		const search = toSearchParams({ ...query, sort: key, dir: nextDir(key), page: 1 });
		return resolve(`/[[lang=locale]]/dashboard/items?${search}`, { lang: locale });
	}
	function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
		if (query.sort !== key) return 'none';
		return query.dir === 'asc' ? 'ascending' : 'descending';
	}

	const hasActiveFilters = $derived(
		query.q !== '' || query.status.length > 0 || query.channel.length > 0 || query.tags.length > 0
	);
	const clearFiltersHref = $derived(resolve('/[[lang=locale]]/dashboard/items', { lang: locale }));

	const headerClass = 'px-4 py-3 text-sm font-medium text-ink-muted';
	const cellClass = 'px-4 py-3 text-sm text-ink';
	const numericClass = 'text-right [font-variant-numeric:tabular-nums]';
</script>

<div>
	{#if page.total === 0}
		<div
			data-testid="items-empty-state"
			class="rounded-(--radius-card) border border-border bg-surface px-4 py-8 text-center text-sm text-ink-muted"
		>
			<p>{t(locale, 'dashboard.items.empty')}</p>
			{#if hasActiveFilters}
				<a
					href={clearFiltersHref}
					class="mt-2 inline-block font-medium text-accent-ink hover:underline"
				>
					{t(locale, 'dashboard.items.clearFilters')}
				</a>
			{/if}
		</div>
	{:else}
		<table class="w-full table-fixed border-collapse">
			<caption class="sr-only">{t(locale, 'dashboard.items.title')}</caption>
			<!-- Status is the widest non-name column because it is the only editable one: at 10% the
			     bordered select clipped its own longest label ("Completed") behind the chevron. -->
			<colgroup>
				<col class="w-[19%]" />
				<col class="w-[15%]" />
				<col class="w-[9%]" />
				<col class="w-[13%]" />
				<col class="w-[11%]" />
				<col class="w-[11%]" />
				<col class="w-[8%]" />
				<col class="w-[14%]" />
			</colgroup>
			<thead>
				<tr class="border-b border-border">
					{#each COLUMNS as column (column.key)}
						<th
							scope="col"
							aria-sort={ariaSort(column.key)}
							class={`${headerClass} ${column.numeric ? 'text-right' : 'text-left'}`}
						>
							<a
								href={sortHref(column.key)}
								data-sveltekit-noscroll
								class={`inline-flex items-center gap-1 hover:text-ink ${query.sort === column.key ? 'text-ink' : ''}`}
							>
								{t(locale, column.label)}
								<span aria-hidden="true">{arrow(column.key)}</span>
							</a>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each page.rows as item (item.id)}
					<tr class="border-b border-border">
						<!--
							Truncated to one line, with the full name on hover and for assistive tech. Names
							are long enough to wrap at this column width, and a wrapped name made rows 65px
							while ROW_HEIGHT_PX reserved 45 — so the skeleton under-reserved and every row
							was a different height depending on its text. One line per row is what makes the
							reservation a fact rather than an estimate, and it is how a data table of this
							density is normally read.
						-->
						<th scope="row" title={item.name} class={`${cellClass} truncate text-left font-normal`}
							>{item.name}</th
						>
						<td class={cellClass}>
							<StatusCell {item} {locale} {canEdit} {optimistic} />
						</td>
						<td class={cellClass}>{t(locale, `channel.${item.channel}`)}</td>
						<td class={cellClass}>{item.owner.name}</td>
						<td class={`${cellClass} ${numericClass}`}>{formatCurrency(item.budget, locale)}</td>
						<td class={`${cellClass} ${numericClass}`}>{formatCurrency(item.spent, locale)}</td>
						<td class={`${cellClass} ${numericClass}`}>{formatPercent(item.ctr, locale)}</td>
						<td class={`${cellClass} ${numericClass}`}>{formatDate(item.updatedAt, locale)}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<Pager
			page={page.page}
			pageCount={page.pageCount}
			total={page.total}
			perPage={query.perPage}
			{query}
			{locale}
		/>
	{/if}
</div>
