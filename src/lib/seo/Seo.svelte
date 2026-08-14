<script lang="ts">
	import { page } from '$app/state';
	import { swapLocale } from './paths';

	interface Props {
		title: string;
		description: string;
		canonicalPath: string;
		type?: 'website' | 'article';
		jsonLd?: string;
	}

	let { title, description, canonicalPath, type = 'website', jsonLd }: Props = $props();

	const origin = $derived(page.url.origin);
	const canonical = $derived(`${origin}${canonicalPath}`);
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
	<meta name="twitter:card" content="summary_large_image" />
	{#if jsonLd}
		<!-- jsonLd comes only from jsonld.ts, which escapes < before returning — never user input. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags, no-useless-escape -->
		{@html `<script type="application/ld+json">${jsonLd}<\/script>`}
	{/if}
</svelte:head>
