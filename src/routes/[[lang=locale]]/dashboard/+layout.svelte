<script lang="ts">
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
	<Container class="flex h-12 items-center justify-between text-sm">
		{#if data.user}
			<span class="text-ink-muted">{data.user.name} · {data.user.role}</span>
		{/if}
		<form method="POST" action={`/${locale}/dashboard?/logout`}>
			<Button type="submit" variant="ghost" size="sm">{t(locale, 'nav.logout')}</Button>
		</form>
	</Container>
</div>

{@render children()}
