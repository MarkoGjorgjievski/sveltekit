<script lang="ts">
	import { t } from '$lib/i18n/t';
	import Container from '$lib/ui/Container.svelte';
	import Text from '$lib/ui/Text.svelte';
	import type { PageProps } from './$types';

	// Placeholder — Task 11 replaces this with the real landing page.
	let { data }: PageProps = $props();
</script>

<Container class="py-16">
	<Text as="h1">{t(data.locale, 'home.hero.title')}</Text>
	<Text as="p" class="mt-4 text-ink-muted">{t(data.locale, 'home.hero.subtitle')}</Text>
</Container>
