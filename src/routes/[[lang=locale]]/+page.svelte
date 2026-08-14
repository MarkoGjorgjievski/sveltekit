<script lang="ts">
	import { page } from '$app/state';
	import { t } from '$lib/i18n/t';
	import { organizationJsonLd } from '$lib/seo/jsonld';
	import Seo from '$lib/seo/Seo.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Card from '$lib/ui/Card.svelte';
	import Container from '$lib/ui/Container.svelte';
	import Text from '$lib/ui/Text.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
	// /blog doesn't exist until Task 12; a plain string href (same pattern +layout.svelte already
	// uses for nav) is the only option since resolve() needs a route id that exists today.
	const blogHref = $derived(`/${locale}/blog`);
	const jsonLd = $derived(organizationJsonLd(page.url.origin));

	const features = $derived([
		{
			title: t(locale, 'home.features.item1.title'),
			description: t(locale, 'home.features.item1.description')
		},
		{
			title: t(locale, 'home.features.item2.title'),
			description: t(locale, 'home.features.item2.description')
		},
		{
			title: t(locale, 'home.features.item3.title'),
			description: t(locale, 'home.features.item3.description')
		}
	]);

	const tiers = $derived([
		{
			name: t(locale, 'home.pricing.tier.starter.name'),
			price: t(locale, 'home.pricing.tier.starter.price'),
			description: t(locale, 'home.pricing.tier.starter.description'),
			badge: null
		},
		{
			name: t(locale, 'home.pricing.tier.pro.name'),
			price: t(locale, 'home.pricing.tier.pro.price'),
			description: t(locale, 'home.pricing.tier.pro.description'),
			badge: t(locale, 'home.pricing.tier.pro.badge')
		},
		{
			name: t(locale, 'home.pricing.tier.team.name'),
			price: t(locale, 'home.pricing.tier.team.price'),
			description: t(locale, 'home.pricing.tier.team.description'),
			badge: null
		}
	]);

	const quotes = $derived([
		{
			text: t(locale, 'home.proof.quote1.text'),
			author: t(locale, 'home.proof.quote1.author'),
			role: t(locale, 'home.proof.quote1.role')
		},
		{
			text: t(locale, 'home.proof.quote2.text'),
			author: t(locale, 'home.proof.quote2.author'),
			role: t(locale, 'home.proof.quote2.role')
		},
		{
			text: t(locale, 'home.proof.quote3.text'),
			author: t(locale, 'home.proof.quote3.author'),
			role: t(locale, 'home.proof.quote3.role')
		}
	]);

	// Fixed-size CSS-coloured initials in place of an avatar image — the fixtures carry no images
	// at all, and this keeps the shape (and the layout) identical before and after hydration.
	function initials(name: string): string {
		return name
			.split(' ')
			.map((part) => part[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}
</script>

<Seo
	title={t(locale, 'home.hero.title')}
	description={t(locale, 'home.hero.subtitle')}
	canonicalPath={`/${locale}`}
	{jsonLd}
/>

<section class="py-20">
	<Container class="flex flex-col items-center gap-6 text-center">
		<Text as="h1">{t(locale, 'home.hero.title')}</Text>
		<Text as="p" class="max-w-2xl text-lg text-ink-muted">
			{t(locale, 'home.hero.subtitle')}
		</Text>
		<Button href={blogHref}>{t(locale, 'home.hero.cta')}</Button>
	</Container>
</section>

<section class="bg-surface-muted py-16">
	<Container>
		<Text as="h2" class="text-center">{t(locale, 'home.features.title')}</Text>
		<div class="mt-10 grid gap-6 sm:grid-cols-3">
			{#each features as feature (feature.title)}
				<Card>
					<Text as="h3">{feature.title}</Text>
					<Text as="p" class="mt-2 text-ink-muted">{feature.description}</Text>
				</Card>
			{/each}
		</div>
	</Container>
</section>

<section class="py-16">
	<Container>
		<Text as="h2" class="text-center">{t(locale, 'home.pricing.title')}</Text>
		<div class="mt-10 grid gap-6 sm:grid-cols-3">
			{#each tiers as tier (tier.name)}
				<Card class="flex flex-col gap-4">
					<div class="flex h-6 items-center">
						{#if tier.badge}
							<Badge tone="accent">{tier.badge}</Badge>
						{/if}
					</div>
					<Text as="h3">{tier.name}</Text>
					<Text as="p" class="text-2xl font-bold">{tier.price}</Text>
					<Text as="p" class="text-ink-muted">{tier.description}</Text>
					<Button href={blogHref} variant="secondary" class="mt-auto">
						{t(locale, 'home.pricing.cta')}
					</Button>
				</Card>
			{/each}
		</div>
	</Container>
</section>

<section class="bg-surface-muted py-16">
	<Container>
		<Text as="h2" class="text-center">{t(locale, 'home.proof.title')}</Text>
		<div class="mt-10 grid gap-6 sm:grid-cols-3">
			{#each quotes as quote (quote.author)}
				<Card class="flex flex-col gap-4">
					<Text as="p" class="text-ink-muted">&ldquo;{quote.text}&rdquo;</Text>
					<div class="flex items-center gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-surface text-sm font-semibold text-accent-ink"
						>
							{initials(quote.author)}
						</div>
						<div>
							<Text as="p" class="font-medium">{quote.author}</Text>
							<Text as="p" class="text-sm text-ink-muted">{quote.role}</Text>
						</div>
					</div>
				</Card>
			{/each}
		</div>
	</Container>
</section>
