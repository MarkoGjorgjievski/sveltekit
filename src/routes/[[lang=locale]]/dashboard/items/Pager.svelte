<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Locale } from '$lib/schemas/post';
	import { t } from '$lib/i18n/t';
	import { toSearchParams, type ItemQuery } from '$lib/url/query-codec';

	interface Props {
		page: number;
		pageCount: number;
		total: number;
		perPage: number;
		query: ItemQuery;
		locale: Locale;
	}

	let { page, pageCount, total, perPage, query, locale }: Props = $props();

	const from = $derived(total === 0 ? 0 : (page - 1) * perPage + 1);
	const to = $derived(Math.min(page * perPage, total));

	function hrefFor(target: number) {
		const search = toSearchParams({ ...query, page: target });
		return resolve(`/[[lang=locale]]/dashboard/items?${search}`, { lang: locale });
	}

	// A compact window rather than every page number, so a 22-page result doesn't turn the pager
	// into 22 tab stops. Always keeps the first page, the last page, and up to two neighbours on
	// each side of the current page; the gaps between kept numbers collapse to a single
	// non-interactive ellipsis rather than being skipped silently. Built and deduped as a plain
	// array — a handful of numbers doesn't warrant a Set, reactive or not.
	const pageNumbers = $derived.by((): (number | 'ellipsis')[] => {
		const candidates = [1, pageCount];
		for (let offset = -2; offset <= 2; offset++) {
			const candidate = page + offset;
			if (candidate >= 1 && candidate <= pageCount) candidates.push(candidate);
		}
		const sorted = candidates
			.filter((value, index) => candidates.indexOf(value) === index)
			.sort((a, b) => a - b);
		const result: (number | 'ellipsis')[] = [];
		for (let index = 0; index < sorted.length; index++) {
			if (index > 0 && sorted[index] - sorted[index - 1] > 1) result.push('ellipsis');
			result.push(sorted[index]);
		}
		return result;
	});

	const linkClass =
		'inline-flex h-8 min-w-8 items-center justify-center rounded-(--radius-control) px-2 text-sm font-medium text-ink hover:bg-surface-muted';
	const currentClass =
		'inline-flex h-8 min-w-8 items-center justify-center rounded-(--radius-control) bg-accent-surface px-2 text-sm font-medium text-accent-ink';
	const edgeClass =
		'inline-flex h-8 items-center justify-center rounded-(--radius-control) px-3 text-sm font-medium text-ink hover:bg-surface-muted';
	// A disabled edge is rendered as a span, not a disabled anchor: a disabled anchor is still
	// focusable and still announced as a link by assistive tech, so it would be a tab stop that
	// does nothing — worse than not being a tab stop at all.
	const disabledEdgeClass =
		'inline-flex h-8 items-center justify-center rounded-(--radius-control) px-3 text-sm font-medium text-ink-muted';
</script>

<div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<p class="text-sm text-ink-muted">{t(locale, 'dashboard.items.showing', { from, to, total })}</p>

	{#if pageCount > 1}
		<nav aria-label={t(locale, 'dashboard.items.pager.navigation')}>
			<ul class="flex flex-wrap items-center gap-1">
				<li>
					{#if page > 1}
						<a href={hrefFor(page - 1)} class={edgeClass} data-sveltekit-noscroll>
							{t(locale, 'dashboard.items.pager.previous')}
						</a>
					{:else}
						<span class={disabledEdgeClass}>{t(locale, 'dashboard.items.pager.previous')}</span>
					{/if}
				</li>

				{#each pageNumbers as entry, index (index)}
					<li>
						{#if entry === 'ellipsis'}
							<span class="px-1 text-sm text-ink-muted" aria-hidden="true">…</span>
						{:else if entry === page}
							<a
								href={hrefFor(entry)}
								aria-current="page"
								class={currentClass}
								data-sveltekit-noscroll
							>
								{entry}
							</a>
						{:else}
							<a
								href={hrefFor(entry)}
								aria-label={t(locale, 'dashboard.items.pager.page', { page: entry })}
								class={linkClass}
								data-sveltekit-noscroll
							>
								{entry}
							</a>
						{/if}
					</li>
				{/each}

				<li>
					{#if page < pageCount}
						<a href={hrefFor(page + 1)} class={edgeClass} data-sveltekit-noscroll>
							{t(locale, 'dashboard.items.pager.next')}
						</a>
					{:else}
						<span class={disabledEdgeClass}>{t(locale, 'dashboard.items.pager.next')}</span>
					{/if}
				</li>
			</ul>
		</nav>
	{/if}
</div>
