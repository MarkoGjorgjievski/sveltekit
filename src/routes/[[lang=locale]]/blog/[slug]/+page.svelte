<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { formatDate } from '$lib/i18n/format';
	import { t } from '$lib/i18n/t';
	import { articleJsonLd, breadcrumbJsonLd } from '$lib/seo/jsonld';
	import Seo from '$lib/seo/Seo.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Container from '$lib/ui/Container.svelte';
	import Text from '$lib/ui/Text.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
	const post = $derived(data.post);
	const translation = $derived(post.translations[locale]);
	// Bodies are plain text, not markdown (schemas.json's label is wrong) — the only structure is
	// blank-line paragraph breaks, so splitting on them is the whole job. No parser, no {@html}.
	// \r?\n\r?\n tolerates CRLF line endings, and filter(Boolean) drops the empty paragraph a
	// trailing blank line would otherwise produce.
	const paragraphs = $derived(translation.body.split(/\r?\n\r?\n/).filter(Boolean));
	const canonicalPath = $derived(`/${locale}/blog/${post.slug}`);
	const blogHref = $derived(resolve('/[[lang=locale]]/blog', { lang: locale }));
	const homeHref = $derived(resolve('/[[lang=locale]]', { lang: locale }));

	// Seo takes a single jsonLd string. Both helpers already return a full, serialized JSON-LD
	// object (their own {@context, @type, ...}), so two of them combine as a top-level JSON array
	// rather than nesting one inside the other — each element still carries its own @context.
	const jsonLd = $derived(
		`[${articleJsonLd(post, locale, page.url.origin)},${breadcrumbJsonLd([
			{ name: t(locale, 'nav.home'), url: `${page.url.origin}${homeHref}` },
			{ name: t(locale, 'nav.blog'), url: `${page.url.origin}${blogHref}` },
			{ name: translation.title, url: `${page.url.origin}${canonicalPath}` }
		])}]`
	);
</script>

<Seo
	title={translation.title}
	description={translation.excerpt}
	{canonicalPath}
	type="article"
	{jsonLd}
/>

<Container class="py-16">
	<a href={blogHref} class="text-sm font-medium text-ink-muted hover:text-ink hover:underline">
		{t(locale, 'nav.blog')}
	</a>

	<!-- The other half of the pair named in PostCard: same view-transition-name, so navigating from
	     the index morphs that card's cover into this header instead of cross-fading the page. -->
	<div
		aria-hidden="true"
		class="mt-4 h-40 w-full rounded-(--radius-card)"
		style="view-transition-name: cover-{post.slug}; background: linear-gradient(135deg, {post.coverColor}, color-mix(in oklab, {post.coverColor} 55%, white))"
	></div>

	<Text as="h1" class="mt-6">{translation.title}</Text>

	<div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
		<span>{post.author.name}</span>
		<span aria-hidden="true">&middot;</span>
		<span>{formatDate(post.publishedAt, locale)}</span>
		<span aria-hidden="true">&middot;</span>
		<span>{t(locale, 'blog.readingTime', { minutes: post.readingTimeMinutes })}</span>
	</div>

	{#if post.tags.length > 0}
		<div class="mt-4 flex flex-wrap gap-2">
			{#each post.tags as tag (tag)}
				<Badge>{tag}</Badge>
			{/each}
		</div>
	{/if}

	<div class="mt-8 max-w-3xl">
		{#each paragraphs as paragraph, index (index)}
			<Text as="p" class="mt-4 first:mt-0">{paragraph}</Text>
		{/each}
	</div>
</Container>
