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

	// The element the post page morphs this card into. Named per slug so the browser pairs THIS
	// card with THAT header rather than cross-fading nine identical covers into one.
	const coverName = $derived(`cover-${post.slug}`);
</script>

<article>
	<Card class="flex h-full flex-col gap-3 overflow-hidden !p-0">
		<div
			aria-hidden="true"
			class="h-24 w-full"
			style="view-transition-name: {coverName}; background: linear-gradient(135deg, {post.coverColor}, color-mix(in oklab, {post.coverColor} 55%, white))"
		></div>
		<div class="flex flex-1 flex-col gap-3 p-6 pt-3">
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
		</div>
	</Card>
</article>
