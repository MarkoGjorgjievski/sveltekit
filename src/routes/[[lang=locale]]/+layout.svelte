<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import { onNavigate } from '$app/navigation';
	import { onMount, setContext } from 'svelte';
	import { t } from '$lib/i18n/t';
	import { swapLocale } from '$lib/seo/paths';
	import Button from '$lib/ui/Button.svelte';
	import Container from '$lib/ui/Container.svelte';
	import ToastRegion from '$lib/ui/ToastRegion.svelte';
	import { TOAST_KEY, createToastQueue } from '$lib/ui/toast.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Context rather than a module-level store: a module-level singleton would be shared across
	// requests during SSR, leaking one user's toast into another user's response.
	setContext(TOAST_KEY, createToastQueue());

	// hooks.server.ts substitutes %lang% into the opening <html> tag, which only happens for a full
	// document response — a client-side navigation between locales cannot go through it, so without
	// this the attribute keeps announcing the language the tab was opened in. That is a correctness
	// problem for screen readers and for the browser's own hyphenation and translation prompts,
	// not a cosmetic one.
	$effect(() => {
		document.documentElement.lang = locale;
	});

	// Cross-document-style transitions for client-side navigations. Returning a promise makes
	// SvelteKit wait for the transition to be ready before swapping the DOM; resolving inside the
	// callback and then awaiting navigation.complete is the order the API requires.
	//
	// Both guards matter: startViewTransition is still absent in Firefox and older Safari, and
	// animating a whole page against a user's reduced-motion preference is exactly the kind of
	// motion that setting exists to prevent.
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	// Imported dynamically, after mount, on purpose. A static import would pull web-vitals into the
	// public initial bundle — measuring the page more slowly in order to report how slow it is —
	// and the landing budget has barely a kilobyte of headroom. As a lazy chunk it costs the
	// critical path nothing. Failure is swallowed: telemetry is never worth breaking a page over.
	onMount(() => {
		void import('$lib/rum/vitals')
			.then(({ reportWebVitals }) => reportWebVitals(0.1))
			.catch(() => {});
	});

	const locale = $derived(data.locale);
	const otherLocale = $derived(locale === 'en' ? 'de' : 'en');
	const home = $derived(resolve('/[[lang=locale]]', { lang: locale }));

	// A prerendered page cannot read url.search. The query only matters once hydrated —
	// the theme toggle and locale switch should return the user to the exact URL they
	// were on — so consult it in the browser and fall back to the path on the server.
	const search = $derived(browser ? page.url.search : '');

	// Where the theme-toggle action should send the browser back to after it flips the cookie —
	// used only on the no-JavaScript path, where the action really does redirect.
	const redirectTo = $derived(page.url.pathname + search);

	// Seeded once from the server-rendered value and owned by the client thereafter. Deliberately
	// not `$derived(data.theme)`: the layout load reads `locals.theme`, which SvelteKit cannot
	// track, so on a client-side navigation `data.theme` can still describe the theme the tab was
	// opened with — and a derived would then snap the icon back while the page stayed the other
	// colour. This layout instance survives those navigations, so plain state is the honest model.
	// svelte-ignore state_referenced_locally
	let theme = $state<'light' | 'dark'>(data.theme);
	// Hand-written rather than `use:enhance`. This layout wraps the whole public surface, and
	// pulling $app/forms into the entry chunk for a single fire-and-forget POST cost 550 B of the
	// landing budget — the dashboard already imports it, where the form machinery earns its place.
	// Without JavaScript this handler never runs and the browser submits the form normally.
	async function flipTheme(event: SubmitEvent) {
		event.preventDefault();

		theme = theme === 'dark' ? 'light' : 'dark';
		// hooks.server.ts writes this attribute for full document responses; here the client owns
		// it, and the POST still lands so the cookie agrees on the next real load.
		document.documentElement.dataset.theme = theme;

		const form = event.currentTarget as HTMLFormElement;
		// redirect: 'manual' — the action answers 303 back to this page, and following it would be
		// the full navigation this exists to avoid. Set-Cookie still applies.
		await fetch(form.action, {
			method: 'POST',
			body: new FormData(form),
			redirect: 'manual'
		}).catch(() => {
			// A failed toggle is not worth surfacing; the next real load re-reads the cookie.
		});
	}

	const themeLabel = $derived(t(locale, theme === 'dark' ? 'nav.themeToLight' : 'nav.themeToDark'));

	// Same page, other locale — swap only the leading /en or /de segment.
	const otherLocalePath = $derived(`${swapLocale(page.url.pathname, otherLocale)}${search}`);

	// Home, Blog, and Search all resolve through $app/paths now that every route id exists.
	const navLinks = $derived([
		{ href: home, label: t(locale, 'nav.home') },
		{ href: resolve('/[[lang=locale]]/blog', { lang: locale }), label: t(locale, 'nav.blog') },
		{ href: resolve('/[[lang=locale]]/search', { lang: locale }), label: t(locale, 'nav.search') }
	]);
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

			<!--
				Still a real form posting to a real action, so the toggle works with JavaScript off —
				that is what the cookie-based, flicker-free theme buys, and it should not be traded away
				for an icon. The submit handler only upgrades it: with JS the swap is immediate and the
				303 is never followed, because a full navigation to repaint one attribute is exactly the
				sluggishness this replaces.
			-->
			<form method="POST" action={`/${locale}/theme?/theme`} onsubmit={flipTheme}>
				<input type="hidden" name="redirectTo" value={redirectTo} />
				<Button type="submit" variant="ghost" size="sm" ariaLabel={themeLabel}>
					<!-- The icon shows the theme the click leads TO, matching the label. -->
					{#if theme === 'dark'}
						<svg
							aria-hidden="true"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							class="h-4 w-4"
						>
							<circle cx="12" cy="12" r="4" />
							<path
								d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
							/>
						</svg>
					{:else}
						<svg
							aria-hidden="true"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="h-4 w-4"
						>
							<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
						</svg>
					{/if}
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

<ToastRegion {locale} />
