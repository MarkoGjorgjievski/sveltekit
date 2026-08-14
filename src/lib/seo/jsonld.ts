import type { Locale, Post } from '$lib/schemas/post';

export interface Breadcrumb {
	name: string;
	url: string;
}

// `<` becomes `<` so a title/description containing `</script>` can never break out of the
// <script type="application/ld+json"> block Seo.svelte injects this into via {@html}.
function serialize(value: unknown): string {
	return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function articleJsonLd(post: Post, locale: Locale, origin: string): string {
	const translation = post.translations[locale];

	return serialize({
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: translation.title,
		description: translation.excerpt,
		datePublished: post.publishedAt,
		author: { '@type': 'Person', name: post.author.name },
		mainEntityOfPage: {
			'@type': 'WebPage',
			'@id': `${origin}/${locale}/blog/${post.slug}`
		}
	});
}

export function organizationJsonLd(origin: string): string {
	return serialize({
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: 'Demo Co.',
		url: origin
	});
}

export function breadcrumbJsonLd(crumbs: Breadcrumb[]): string {
	return serialize({
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: crumbs.map((crumb, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: crumb.name,
			item: crumb.url
		}))
	});
}
