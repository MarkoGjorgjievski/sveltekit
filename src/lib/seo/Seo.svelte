<script lang="ts">
	import { page } from '$app/state';
	import { swapLocale } from './paths';

	interface Props {
		title: string;
		description: string;
		canonicalPath: string;
		type?: 'website' | 'article';
		/** Absolute-from-root path to a card image, e.g. /og/my-post.png. */
		imagePath?: string;
		jsonLd?: string;
	}

	let { title, description, canonicalPath, type = 'website', imagePath, jsonLd }: Props = $props();

	const origin = $derived(page.url.origin);
	const canonical = $derived(`${origin}${canonicalPath}`);
	const image = $derived(imagePath ? `${origin}${imagePath}` : undefined);
	const alternates = $derived(
		(['en', 'de'] as const).map((locale) => ({
			locale,
			href: `${origin}${swapLocale(canonicalPath, locale)}`
		}))
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	{#each alternates as alternate (alternate.locale)}
		<link rel="alternate" hreflang={alternate.locale} href={alternate.href} />
	{/each}
	<link rel="alternate" hreflang="x-default" href={alternates[0].href} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content={type} />
	<meta property="og:url" content={canonical} />
	{#if image}
		<!-- twitter:card promises a large image below, so without one the card renders as an empty
		     frame. og:image is what fills it; twitter reads og:image when twitter:image is absent. -->
		<meta property="og:image" content={image} />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
	{/if}
	<meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
	{#if jsonLd}
		<!-- jsonLd comes only from jsonld.ts, which escapes < before returning — never user input. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags, no-useless-escape -->
		{@html `<script type="application/ld+json">${jsonLd}<\/script>`}
	{/if}
</svelte:head>
