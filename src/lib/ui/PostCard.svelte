<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Locale, Post } from '$lib/schemas/post';
	import { formatDate } from '$lib/i18n/format';
	import { t } from '$lib/i18n/t';
	import Card from './Card.svelte';
	import Text from './Text.svelte';

	interface Props {
		post: Post;
		locale: Locale;
	}

	let { post, locale }: Props = $props();

	const translation = $derived(post.translations[locale]);
	const href = $derived(resolve('/[[lang=locale]]/blog/[slug]', { lang: locale, slug: post.slug }));
</script>

<article>
	<Card class="flex h-full flex-col gap-3">
		<a {href} class="hover:underline">
			<Text as="h2">{translation.title}</Text>
		</a>
		<Text as="p" class="text-ink-muted">{translation.excerpt}</Text>
		<div class="flex items-center gap-2 text-sm text-ink-muted">
			<span>{formatDate(post.publishedAt, locale)}</span>
			<span aria-hidden="true">&middot;</span>
			<span>{t(locale, 'blog.readingTime', { minutes: post.readingTimeMinutes })}</span>
		</div>
		<!-- Decorative duplicate of the title link above: same destination, visible "read more"
		     affordance. Hidden from assistive tech and the tab order so a screen reader's link list
		     doesn't show nine identical "Read post" entries alongside the nine titled ones. -->
		<a
			{href}
			aria-hidden="true"
			tabindex="-1"
			class="mt-auto text-sm font-medium text-accent-ink hover:underline"
		>
			{t(locale, 'blog.readMore')}
		</a>
	</Card>
</article>
