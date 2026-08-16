<script lang="ts">
	import { onDestroy } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		ITEM_CHANNELS,
		ITEM_STATUSES,
		type ItemChannel,
		type ItemStatus
	} from '$lib/schemas/item';
	import { PER_PAGE_OPTIONS } from '$lib/schemas/query';
	import type { Locale } from '$lib/schemas/post';
	import { t } from '$lib/i18n/t';
	import { QUERY_PARAM, toSearchParams, type ItemQuery } from '$lib/url/query-codec';
	import type { FacetCounts } from '$lib/server/data/items.repo';
	import Combobox from '$lib/ui/Combobox.svelte';

	interface Props {
		query: ItemQuery;
		// Undefined until the streamed result resolves — this bar renders immediately from `query`
		// alone (built synchronously with the page shell), so per-option counts arrive a tick
		// later rather than being a reason to delay the whole bar.
		facets: FacetCounts | undefined;
		locale: Locale;
	}

	let { query, facets, locale }: Props = $props();

	const formAction = $derived(resolve('/[[lang=locale]]/dashboard/items', { lang: locale }));
	const clearFiltersHref = $derived(resolve('/[[lang=locale]]/dashboard/items', { lang: locale }));

	const hasActiveFilters = $derived(
		query.q !== '' || query.status.length > 0 || query.channel.length > 0 || query.tags.length > 0
	);

	const statusOptions = $derived(
		ITEM_STATUSES.map((status) => ({
			value: status,
			label: t(locale, `status.${status}`),
			count: facets?.status[status]
		}))
	);

	const channelOptions = $derived(
		ITEM_CHANNELS.map((channel) => ({
			value: channel,
			label: t(locale, `channel.${channel}`),
			count: facets?.channel[channel]
		}))
	);

	// The set of tag values itself — not just their counts — comes from the resolved facets
	// (tags are free-text, fixture-driven data with no fixed enum), so there is nothing to show
	// here until the first result resolves.
	const tagOptions = $derived(
		facets
			? Object.keys(facets.tags)
					.sort()
					.map((tag) => ({ value: tag, label: tag, count: facets.tags[tag] }))
			: []
	);

	// Local echo of the text box, distinct from `query.q` — a keystroke updates this immediately
	// so the box never stalls, while the URL (and therefore `query.q`) only catches up after the
	// debounce below. Resyncs whenever `query.q` itself changes from elsewhere (back/forward, a
	// no-JS submit, the clear-filters link).
	let qValue = $derived(query.q);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	onDestroy(() => clearTimeout(debounceTimer));

	// A pending keystroke timer must not outlive the navigation it was racing — the exact bug
	// found and fixed on the search route. Without this, a timer armed before a navigation (e.g.
	// a facet pick, or Back/Forward) fires afterwards and overwrites the newer URL with stale
	// input text.
	beforeNavigate(() => clearTimeout(debounceTimer));

	function withPatch(patch: Partial<ItemQuery>) {
		const search = toSearchParams({ ...query, ...patch, page: 1 });
		return resolve(`/[[lang=locale]]/dashboard/items?${search}`, { lang: locale });
	}

	function handleQueryInput(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		qValue = value;
		clearTimeout(debounceTimer);
		// Typing replaces history state — every keystroke becoming its own entry would make Back
		// walk one character at a time instead of to whatever the user was looking at before they
		// started typing. keepFocus keeps the caret in the box across the navigation.
		debounceTimer = setTimeout(() => {
			goto(withPatch({ q: value }), { replaceState: true, keepFocus: true, noScroll: true });
		}, 250);
	}

	// A facet pick is a state the user expects Back to step through, so — unlike typing — this
	// pushes a new history entry rather than replacing the current one.
	function handleStatusChange(next: string[]) {
		goto(withPatch({ status: next as ItemStatus[] }), {
			replaceState: false,
			keepFocus: true,
			noScroll: true
		});
	}

	function handleChannelChange(next: string[]) {
		goto(withPatch({ channel: next as ItemChannel[] }), {
			replaceState: false,
			keepFocus: true,
			noScroll: true
		});
	}

	function handleTagsChange(next: string[]) {
		goto(withPatch({ tags: next }), { replaceState: false, keepFocus: true, noScroll: true });
	}

	function handlePerPageChange(event: Event) {
		const value = Number((event.currentTarget as HTMLSelectElement).value);
		goto(withPatch({ perPage: value as ItemQuery['perPage'] }), {
			replaceState: false,
			keepFocus: true,
			noScroll: true
		});
	}

	const fieldClass =
		'h-9 rounded-(--radius-control) border border-border-strong bg-surface px-3 text-sm text-ink';
</script>

<form
	method="GET"
	action={formAction}
	aria-label={t(locale, 'dashboard.items.filters')}
	class="flex flex-col gap-4 border-b border-border pb-4"
>
	<!-- Sort and direction are already in the URL, driven entirely by ItemsTable's sort-header
	     links — this form never lets the user set them directly. But a plain GET submit replaces
	     the whole query string with only the fields the form itself carries, so without these,
	     submitting a filter change with JavaScript disabled would silently reset sorting to the
	     server's default. Carrying them forward as hidden inputs keeps the no-JS submit path and
	     the JS goto() path (which spreads {...query, ...patch}) equivalent. `page` is deliberately
	     not carried the same way: a filter change resets it to 1, and omitting it here lets
	     parseQuery's own default do that. -->
	<input type="hidden" name={QUERY_PARAM.sort} value={query.sort} />
	<input type="hidden" name={QUERY_PARAM.dir} value={query.dir} />

	<div class="flex flex-wrap items-end gap-3">
		<div class="flex flex-col gap-1.5">
			<label for="items-filter-q" class="text-sm font-medium text-ink">
				{t(locale, 'dashboard.items.filter.q')}
			</label>
			<input
				id="items-filter-q"
				name={QUERY_PARAM.q}
				type="search"
				value={qValue}
				oninput={handleQueryInput}
				placeholder={t(locale, 'dashboard.items.filter.qPlaceholder')}
				class={fieldClass}
			/>
		</div>

		<div class="w-48">
			<Combobox
				id="items-filter-status"
				label={t(locale, 'dashboard.items.filter.status')}
				options={statusOptions}
				selected={query.status}
				onchange={handleStatusChange}
				{locale}
			/>
		</div>

		<div class="w-48">
			<Combobox
				id="items-filter-channel"
				label={t(locale, 'dashboard.items.filter.channel')}
				options={channelOptions}
				selected={query.channel}
				onchange={handleChannelChange}
				{locale}
			/>
		</div>

		<div class="w-48">
			<Combobox
				id="items-filter-tags"
				label={t(locale, 'dashboard.items.filter.tags')}
				options={tagOptions}
				selected={query.tags}
				onchange={handleTagsChange}
				{locale}
			/>
		</div>

		<!-- The three Comboboxes above are JS-only widgets — their input has no `name`, so a plain
		     GET submit can't carry a facet selection. This fallback gives no-JS users the same
		     filters through real, name-bearing multi-selects. `<noscript>` content is inert markup
		     (never parsed into DOM, never queryable) in a JS-enabled browser, so it never appears
		     as a duplicate control during normal use or in these tests; browsers only parse it into
		     real, focusable elements when JavaScript is unavailable — exactly when the Comboboxes
		     above are the ones that can't work. -->
		<noscript>
			<div class="flex flex-wrap items-end gap-3">
				<div class="flex flex-col gap-1.5">
					<label for="items-filter-status-native" class="text-sm font-medium text-ink">
						{t(locale, 'dashboard.items.filter.status')}
					</label>
					<select
						id="items-filter-status-native"
						name={QUERY_PARAM.status}
						multiple
						class={fieldClass}
					>
						{#each statusOptions as option (option.value)}
							<option value={option.value} selected={query.status.includes(option.value)}>
								{option.label}
							</option>
						{/each}
					</select>
				</div>
				<div class="flex flex-col gap-1.5">
					<label for="items-filter-channel-native" class="text-sm font-medium text-ink">
						{t(locale, 'dashboard.items.filter.channel')}
					</label>
					<select
						id="items-filter-channel-native"
						name={QUERY_PARAM.channel}
						multiple
						class={fieldClass}
					>
						{#each channelOptions as option (option.value)}
							<option value={option.value} selected={query.channel.includes(option.value)}>
								{option.label}
							</option>
						{/each}
					</select>
				</div>
				<div class="flex flex-col gap-1.5">
					<label for="items-filter-tags-native" class="text-sm font-medium text-ink">
						{t(locale, 'dashboard.items.filter.tags')}
					</label>
					<select id="items-filter-tags-native" name={QUERY_PARAM.tags} multiple class={fieldClass}>
						{#each tagOptions as option (option.value)}
							<option value={option.value} selected={query.tags.includes(option.value)}>
								{option.label}
							</option>
						{/each}
					</select>
				</div>
			</div>
		</noscript>

		<div class="flex flex-col gap-1.5">
			<label for="items-filter-perPage" class="text-sm font-medium text-ink">
				{t(locale, 'dashboard.items.filter.perPage')}
			</label>
			<select
				id="items-filter-perPage"
				name={QUERY_PARAM.perPage}
				value={query.perPage}
				onchange={handlePerPageChange}
				class={fieldClass}
			>
				{#each PER_PAGE_OPTIONS as option (option)}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</div>

		<button
			type="submit"
			class="h-9 rounded-(--radius-control) bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-ink"
		>
			{t(locale, 'dashboard.items.apply')}
		</button>

		{#if hasActiveFilters}
			<a href={clearFiltersHref} class="text-sm font-medium text-accent-ink hover:underline">
				{t(locale, 'dashboard.items.clearFilters')}
			</a>
		{/if}
	</div>
</form>
