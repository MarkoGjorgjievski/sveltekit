<script lang="ts">
	import { t } from '$lib/i18n/t';
	import Seo from '$lib/seo/Seo.svelte';
	import BlogList from './BlogList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
	const canonicalPath = $derived(`/${locale}/blog`);
</script>

<Seo title={t(locale, 'blog.title')} description={t(locale, 'blog.description')} {canonicalPath} />

<BlogList locale={data.locale} rows={data.rows} page={data.page} pageCount={data.pageCount} />
