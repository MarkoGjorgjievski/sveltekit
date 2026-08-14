<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Locale, Post } from '$lib/schemas/post';
	import { t } from '$lib/i18n/t';
	import Container from '$lib/ui/Container.svelte';
	import PostCard from '$lib/ui/PostCard.svelte';
	import Text from '$lib/ui/Text.svelte';

	interface Props {
		locale: Locale;
		rows: Post[];
		page: number;
		pageCount: number;
	}

	let { locale, rows, page, pageCount }: Props = $props();

	// Page 1 always lives at /blog, never at /blog/page/1 — see the pager's entries().
	const prevHref = $derived.by(() => {
		if (page <= 1) return null;
		if (page - 1 === 1) return resolve('/[[lang=locale]]/blog', { lang: locale });
		return resolve('/[[lang=locale]]/blog/page/[n]', { lang: locale, n: String(page - 1) });
	});

	const nextHref = $derived(
		page >= pageCount
			? null
			: resolve('/[[lang=locale]]/blog/page/[n]', { lang: locale, n: String(page + 1) })
	);
</script>

<Container class="py-16">
	<Text as="h1">{t(locale, 'blog.title')}</Text>

	{#if rows.length === 0}
		<Text as="p" class="mt-6 text-ink-muted">{t(locale, 'blog.empty')}</Text>
	{:else}
		<div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each rows as post (post.id)}
				<PostCard {post} {locale} />
			{/each}
		</div>

		{#if pageCount > 1}
			<nav class="mt-10 flex items-center justify-between gap-4">
				{#if prevHref}
					<a href={prevHref} class="text-sm font-medium text-ink hover:underline">
						{t(locale, 'blog.pagination.prev')}
					</a>
				{:else}
					<span></span>
				{/if}

				<Text as="p" class="text-sm text-ink-muted">
					{t(locale, 'blog.pagination.page', { page, total: pageCount })}
				</Text>

				{#if nextHref}
					<a href={nextHref} class="text-sm font-medium text-ink hover:underline">
						{t(locale, 'blog.pagination.next')}
					</a>
				{:else}
					<span></span>
				{/if}
			</nav>
		{/if}
	{/if}
</Container>
