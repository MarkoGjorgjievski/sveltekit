<script lang="ts">
	import { page } from '$app/state';
	import { LOCALES, type Locale } from '$lib/schemas/post';
	import { t } from '$lib/i18n/t';
	import Container from '$lib/ui/Container.svelte';
	import Text from '$lib/ui/Text.svelte';
	import Button from '$lib/ui/Button.svelte';

	// This page can render above the [[lang=locale]] layout — a path that matches no route at
	// all (the common 404 shape) never reaches that layout's load, so page.data.locale isn't
	// reliable here. The URL's own leading segment is always available and is what determined
	// the response in the first place, so read the locale from there and fall back to 'en' for
	// anything else (including the root '/' with no segment at all).
	const locale = $derived.by((): Locale => {
		const segment = page.url.pathname.split('/')[1];
		return (LOCALES as readonly string[]).includes(segment) ? (segment as Locale) : 'en';
	});

	const isNotFound = $derived(page.status === 404);
</script>

<Container class="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
	<Text as="h1">
		{isNotFound ? t(locale, 'error.404.title') : t(locale, 'error.generic.title')}
	</Text>

	{#if isNotFound}
		<Text>{t(locale, 'error.404.body')}</Text>
	{:else if page.error?.message}
		<!-- No i18n key exists for a generic error body: the message comes from whatever server
		     error was actually thrown, which isn't known ahead of time and can't be translated. -->
		<Text>{page.error.message}</Text>
	{/if}

	<div class="flex gap-3">
		<!-- Fixed to /en/blog rather than a locale-derived path: the whole point of this fallback
		     is that locale can't be trusted here, so the one link this page promises must not
		     depend on it either. -->
		<Button href="/en/blog" variant="primary">{t(locale, 'nav.blog')}</Button>
		{#if !isNotFound}
			<Button variant="secondary" onclick={() => window.location.reload()}>
				{t(locale, 'common.retry')}
			</Button>
		{/if}
	</div>
</Container>
