<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Locale } from '$lib/schemas/post';
	import type { ItemStatus } from '$lib/schemas/item';
	import type { SortKey } from '$lib/schemas/query';
	import { toSearchParams, type ItemQuery } from '$lib/url/query-codec';
	import type { ItemPage } from '$lib/server/data/items.repo';
	import type { MessageKey } from '$lib/i18n/t';
	import { t } from '$lib/i18n/t';
	import { formatCurrency, formatDate, formatPercent } from '$lib/i18n/format';
	import Badge from '$lib/ui/Badge.svelte';
	import Pager from './Pager.svelte';

	interface Props {
		page: ItemPage;
		query: ItemQuery;
		locale: Locale;
		// Not read yet — the optimistic inline status editor is built in a later task and will read
		// this same prop when it renders in place of the static Badge below. Kept in this
		// component's interface now (rather than added when that task lands) because it is part of
		// this table's stated public contract. There is no honest, non-decorative use for it in
		// this task's markup, so it is destructured but deliberately left unread, with the lint
		// rule that would otherwise flag it disabled on this one line, rather than surfaced as a
		// dead attribute nothing consumes.
		canEdit: boolean;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let { page, query, locale, canEdit }: Props = $props();

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
			<colgroup>
				<col class="w-[20%]" />
				<col class="w-[10%]" />
				<col class="w-[10%]" />
				<col class="w-[14%]" />
				<col class="w-[11%]" />
				<col class="w-[11%]" />
				<col class="w-[9%]" />
				<col class="w-[15%]" />
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
						<th scope="row" class={`${cellClass} text-left font-normal`}>{item.name}</th>
						<td class={cellClass}>
							<Badge tone={STATUS_TONE[item.status]}>{t(locale, `status.${item.status}`)}</Badge>
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
