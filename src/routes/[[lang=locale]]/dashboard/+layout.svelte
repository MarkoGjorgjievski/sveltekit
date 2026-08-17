<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { t } from '$lib/i18n/t';
	import Container from '$lib/ui/Container.svelte';
	import Button from '$lib/ui/Button.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const locale = $derived(data.locale);
</script>

<!-- Dashboard pages are behind auth and carry no SEO value; keep them out of search results. -->
<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="border-b border-border bg-surface-muted">
	<Container class="flex h-12 items-center justify-between gap-4 text-sm">
		<!-- Without these the items table was reachable only by typing its URL: the dashboard index
		     showed a name and a role and linked nowhere at all. -->
		<nav class="flex items-center gap-4" aria-label={t(locale, 'nav.dashboard')}>
			<a
				href={resolve('/[[lang=locale]]/dashboard', { lang: locale })}
				aria-current={page.url.pathname.endsWith('/dashboard') ? 'page' : undefined}
				class="font-medium text-ink-muted hover:text-ink aria-[current=page]:text-ink"
			>
				{t(locale, 'nav.dashboard')}
			</a>
			<a
				href={resolve('/[[lang=locale]]/dashboard/items', { lang: locale })}
				aria-current={page.url.pathname.includes('/dashboard/items') ? 'page' : undefined}
				class="font-medium text-ink-muted hover:text-ink aria-[current=page]:text-ink"
			>
				{t(locale, 'dashboard.items.title')}
			</a>
		</nav>

		<div class="flex items-center gap-3">
			{#if data.user}
				<span class="text-ink-muted">{data.user.name} · {data.user.role}</span>
			{/if}
			<form method="POST" action={`/${locale}/dashboard?/logout`}>
				<Button type="submit" variant="ghost" size="sm">{t(locale, 'nav.logout')}</Button>
			</form>
		</div>
	</Container>
</div>

{@render children()}
