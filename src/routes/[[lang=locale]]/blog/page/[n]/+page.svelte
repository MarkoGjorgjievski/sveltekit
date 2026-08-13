<script lang="ts">
	import { t } from '$lib/i18n/t';
	import Seo from '$lib/seo/Seo.svelte';
	import BlogList from '../../BlogList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(data.locale);
	const canonicalPath = $derived(`/${locale}/blog/page/${data.page}`);
	const title = $derived(
		`${t(locale, 'blog.title')} — ${t(locale, 'blog.pagination.page', { page: data.page, total: data.pageCount })}`
	);
</script>

<Seo {title} description={t(locale, 'blog.description')} {canonicalPath} />

<BlogList locale={data.locale} rows={data.rows} page={data.page} pageCount={data.pageCount} />
