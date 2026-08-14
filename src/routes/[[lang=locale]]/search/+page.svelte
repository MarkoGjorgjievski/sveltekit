<script lang="ts">
	import { onDestroy } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { t } from '$lib/i18n/t';
	import Seo from '$lib/seo/Seo.svelte';
	import Container from '$lib/ui/Container.svelte';
	import PostCard from '$lib/ui/PostCard.svelte';
	import Text from '$lib/ui/Text.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
	const canonicalPath = $derived(`/${locale}/search`);
	const formAction = $derived(resolve('/[[lang=locale]]/search', { lang: locale }));

	// Local echo of the query box, distinct from `data.q` — a keystroke updates this immediately so
	// the box never stalls, while the URL (and therefore `data.q`) only catches up after the debounce.
	// A writable $derived: assigning it below overrides the derivation until `data.q` itself
	// changes again (back/forward, a tag click, a no-JS form submit), at which point it resyncs —
	// no separate $state + $effect pair needed.
	let queryValue = $derived(data.q);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	onDestroy(() => clearTimeout(debounceTimer));

	// A pending keystroke timer must not outlive the navigation it was racing. Tag pills are
	// links and back/forward are in-route, so the component is reused and onDestroy never fires —
	// without this, a timer armed before the navigation lands afterwards and replaces the entry
	// the user just moved to with stale query text.
	beforeNavigate(() => clearTimeout(debounceTimer));

	function buildParams(q: string, tag: string | null, sort: string): URLSearchParams {
		const trimmed = q.trim();
		// Entries passed straight to the constructor, never .set()/.append() afterwards — a plain
		// URLSearchParams built and read this way isn't the mutable-instance pattern
		// svelte/prefer-svelte-reactivity guards against, since nothing here needs reactivity.
		const entries: [string, string][] = [];
		if (trimmed) entries.push(['q', trimmed]);
		if (tag) entries.push(['tag', tag]);
		// relevance is the loader's fallback, so leaving it out of the URL keeps the default state's
		// address clean without changing what the loader resolves it to.
		if (sort !== 'relevance') entries.push(['sort', sort]);
		return new URLSearchParams(entries);
	}

	function searchHref(params: URLSearchParams): ResolvedPathname {
		const query = params.toString();
		return query
			? resolve(`/[[lang=locale]]/search?${query}`, { lang: locale })
			: resolve('/[[lang=locale]]/search', { lang: locale });
	}

	function handleQueryInput(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		queryValue = value;
		clearTimeout(debounceTimer);
		// Typing replaces history state — otherwise every keystroke becomes its own entry and Back
		// walks backwards one character at a time instead of to whatever the user was looking at
		// before they started typing. keepFocus keeps the caret in the box across the navigation.
		debounceTimer = setTimeout(() => {
			goto(searchHref(buildParams(value, data.tag, data.sort)), {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});
		}, 250);
	}

	function handleSortChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		// A facet change is a state a user expects Back to step through, so — unlike typing — this
		// pushes a new history entry rather than replacing the current one.
		goto(searchHref(buildParams(queryValue, data.tag, value)), {
			replaceState: false,
			keepFocus: true,
			noScroll: true
		});
	}

	// searchPosts ANDs the tag and the text query, so once a text query has already produced zero
	// results, a tag pill that preserved it would carry the failing query forward and still return
	// nothing — not a recovery at all. Dropping `q` only in that state is what makes the pill
	// actually change the outcome; while results exist, preserving `q` is the correct behaviour
	// (narrowing the current search by tag), so nothing changes for that case.
	const tagLinkQuery = $derived(data.results.length === 0 ? '' : data.q);
	const tagLinks = $derived(
		data.tags.map((entry) => {
			const active = data.tag === entry.slug;
			return {
				slug: entry.slug,
				label: entry.label[locale],
				active,
				href: searchHref(buildParams(tagLinkQuery, active ? null : entry.slug, data.sort))
			};
		})
	);
	const allTagsHref = $derived(searchHref(buildParams(tagLinkQuery, null, data.sort)));
	const clearQueryHref = $derived(searchHref(buildParams('', data.tag, data.sort)));
</script>

<Seo
	title={t(locale, 'nav.search')}
	description={t(locale, 'search.description')}
	{canonicalPath}
/>

<Container class="py-16">
	<Text as="h1">{t(locale, 'nav.search')}</Text>

	<form
		method="GET"
		action={formAction}
		class="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3"
	>
		<div class="flex flex-1 flex-col gap-1.5">
			<label for="search-q" class="text-sm font-medium text-ink">
				{t(locale, 'search.queryLabel')}
			</label>
			<input
				id="search-q"
				name="q"
				type="search"
				value={queryValue}
				oninput={handleQueryInput}
				placeholder={t(locale, 'search.placeholder')}
				class="h-10 rounded-(--radius-control) border border-border-strong bg-surface px-3 text-sm text-ink"
			/>
		</div>

		<input type="hidden" name="tag" value={data.tag ?? ''} />

		<div class="flex flex-col gap-1.5">
			<label for="search-sort" class="text-sm font-medium text-ink">
				{t(locale, 'search.sortLabel')}
			</label>
			<select
				id="search-sort"
				name="sort"
				value={data.sort}
				onchange={handleSortChange}
				class="h-10 rounded-(--radius-control) border border-border-strong bg-surface px-3 text-sm text-ink"
			>
				<option value="relevance">{t(locale, 'search.sort.relevance')}</option>
				<option value="newest">{t(locale, 'search.sort.newest')}</option>
				<option value="oldest">{t(locale, 'search.sort.oldest')}</option>
			</select>
		</div>

		<button
			type="submit"
			class="h-10 rounded-(--radius-control) bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-ink"
		>
			{t(locale, 'nav.search')}
		</button>
	</form>

	<nav aria-label={t(locale, 'search.filterByTag')} class="mt-6">
		<Text as="p" class="text-sm font-medium text-ink-muted">{t(locale, 'search.filterByTag')}</Text>
		<ul class="mt-2 flex flex-wrap gap-2">
			<li>
				<a
					href={allTagsHref}
					aria-current={data.tag === null ? 'true' : undefined}
					class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {data.tag ===
					null
						? 'bg-accent-surface text-accent-ink'
						: 'bg-surface-muted text-ink-muted hover:text-ink'}"
				>
					{t(locale, 'search.allTags')}
				</a>
			</li>
			{#each tagLinks as tag (tag.slug)}
				<li>
					<a
						href={tag.href}
						aria-current={tag.active ? 'true' : undefined}
						class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {tag.active
							? 'bg-accent-surface text-accent-ink'
							: 'bg-surface-muted text-ink-muted hover:text-ink'}"
					>
						{tag.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	{#if data.results.length === 0}
		<div class="mt-10 flex flex-col items-start gap-2">
			<Text as="p" class="text-ink-muted">{t(locale, 'search.noResults')}</Text>

			{#if data.q}
				<a href={clearQueryHref} class="text-sm font-medium text-accent-ink hover:underline">
					{t(locale, 'search.clearSearch')}
				</a>
			{/if}
		</div>
	{:else}
		{#if data.q}
			<Text as="p" class="mt-8 text-sm text-ink-muted">
				{t(locale, 'search.results', { count: data.results.length, query: data.q })}
			</Text>
		{/if}
		<div class="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.results as post (post.id)}
				<PostCard {post} {locale} />
			{/each}
		</div>
	{/if}
</Container>
