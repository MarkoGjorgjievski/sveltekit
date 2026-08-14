import { describe, expect, it } from 'vitest';
import { getPost } from '$lib/server/data/posts.repo';
import { articleJsonLd, breadcrumbJsonLd, organizationJsonLd } from './jsonld';

const basePost = getPost('accessible-combobox-from-scratch');
if (!basePost) throw new Error('fixture post missing — did posts.json change?');

describe('articleJsonLd', () => {
	it('serialises the headline, excerpt, and canonical url for the given locale', () => {
		const serialised = articleJsonLd(basePost, 'en', 'https://example.test');
		const parsed = JSON.parse(serialised);

		expect(parsed.headline).toBe(basePost.translations.en.title);
		expect(parsed.description).toBe(basePost.translations.en.excerpt);
		expect(parsed.mainEntityOfPage['@id']).toBe(`https://example.test/en/blog/${basePost.slug}`);
	});

	it('escapes < so a closing script tag cannot break out', () => {
		const hostile = {
			...basePost,
			translations: {
				...basePost.translations,
				en: { ...basePost.translations.en, title: '</script><script>alert(1)</script>' }
			}
		};

		const serialised = articleJsonLd(hostile, 'en', 'https://example.test');

		expect(serialised).not.toContain('</script>');
		expect(serialised).toContain('\\u003c');
	});
});

describe('organizationJsonLd', () => {
	it('serialises a schema.org Organization anchored at the given origin', () => {
		const parsed = JSON.parse(organizationJsonLd('https://example.test'));

		expect(parsed['@type']).toBe('Organization');
		expect(parsed.url).toBe('https://example.test');
	});
});

describe('breadcrumbJsonLd', () => {
	it('numbers each crumb by position, starting at 1', () => {
		const parsed = JSON.parse(
			breadcrumbJsonLd([
				{ name: 'Home', url: 'https://example.test/en' },
				{ name: 'Blog', url: 'https://example.test/en/blog' }
			])
		);

		expect(parsed.itemListElement).toHaveLength(2);
		expect(parsed.itemListElement[0].position).toBe(1);
		expect(parsed.itemListElement[1].position).toBe(2);
		expect(parsed.itemListElement[1].name).toBe('Blog');
	});
});
