<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { t } from '$lib/i18n/t';
	import { swapLocale } from '$lib/seo/paths';
	import Button from '$lib/ui/Button.svelte';
	import Container from '$lib/ui/Container.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const locale = $derived(data.locale);
	const otherLocale = $derived(locale === 'en' ? 'de' : 'en');
	const home = $derived(resolve('/[[lang=locale]]', { lang: locale }));

	// Where the theme-toggle action should send the browser back to after it flips the cookie.
	const redirectTo = $derived(page.url.pathname + page.url.search);

	// Same page, other locale — swap only the leading /en or /de segment.
	const otherLocalePath = $derived(
		`${swapLocale(page.url.pathname, otherLocale)}${page.url.search}`
	);

	// Home and Blog now resolve through $app/paths, since both route ids exist. Search stays a
	// plain string (its route doesn't exist until Task 13) and keeps its own suppression below.
	const navLinks = $derived([
		{ href: home, label: t(locale, 'nav.home') },
		{ href: resolve('/[[lang=locale]]/blog', { lang: locale }), label: t(locale, 'nav.blog') }
	]);
	const searchHref = $derived(`/${locale}/search`);
</script>

<!--
	The locale switcher still builds a plain string (swapLocale()'s return type isn't the branded
	ResolvedPathname resolve() produces), so `resolve()` can't type-check it — same tradeoff
	Button.svelte already documents for its caller-supplied href.
-->

<a
	href="#main"
	class="sr-only rounded-(--radius-control) bg-accent px-4 py-2 text-accent-foreground focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
>
	{t(locale, 'a11y.skipToContent')}
</a>

<header class="border-b border-border bg-surface">
	<Container class="flex h-16 items-center justify-between gap-4">
		<a href={home} class="text-lg font-semibold text-ink">Demo Co.</a>

		<nav class="flex items-center gap-6">
			{#each navLinks as link (link.href)}
				<a href={link.href} class="text-sm font-medium text-ink-muted hover:text-ink">
					{link.label}
				</a>
			{/each}
			<!-- resolve() once /search exists (task 13) -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={searchHref} class="text-sm font-medium text-ink-muted hover:text-ink">
				{t(locale, 'nav.search')}
			</a>
		</nav>

		<div class="flex items-center gap-3">
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={otherLocalePath}
				hreflang={otherLocale}
				class="text-sm font-medium text-ink-muted uppercase hover:text-ink"
			>
				{otherLocale}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->

			<form method="POST" action={`/${locale}/theme?/theme`}>
				<input type="hidden" name="redirectTo" value={redirectTo} />
				<Button type="submit" variant="ghost" size="sm">
					{t(locale, 'nav.toggleTheme')}
				</Button>
			</form>
		</div>
	</Container>
</header>

<main id="main">
	{@render children()}
</main>

<footer class="border-t border-border bg-surface-muted">
	<Container class="py-8 text-sm text-ink-muted">
		{t(locale, 'footer.copy')}
	</Container>
</footer>
