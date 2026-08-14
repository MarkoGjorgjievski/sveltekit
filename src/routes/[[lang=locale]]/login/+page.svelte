<script lang="ts">
	import { t } from '$lib/i18n/t';
	import Container from '$lib/ui/Container.svelte';
	import Card from '$lib/ui/Card.svelte';
	import Input from '$lib/ui/Input.svelte';
	import Button from '$lib/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const locale = $derived(data.locale);
	const redirectTo = $derived(data.redirectTo);
</script>

<svelte:head>
	<title>{t(locale, 'login.title')}</title>
</svelte:head>

<Container class="flex min-h-[60vh] items-center justify-center py-16">
	<Card class="w-full max-w-sm">
		<h1 class="mb-6 text-xl font-semibold text-ink">{t(locale, 'login.title')}</h1>

		<form method="POST" class="flex flex-col gap-4">
			<input type="hidden" name="redirectTo" value={redirectTo} />

			<Input
				id="email"
				name="email"
				type="email"
				label={t(locale, 'login.email')}
				value={form?.email ?? ''}
				error={form?.errors?.email}
				required
			/>

			<Input
				id="password"
				name="password"
				type="password"
				label={t(locale, 'login.password')}
				error={form?.errors?.password}
				required
			/>

			{#if form?.errors?.form}
				<p class="text-sm text-danger-ink" role="alert">{t(locale, 'login.error')}</p>
			{/if}

			<Button type="submit">{t(locale, 'login.submit')}</Button>
		</form>
	</Card>
</Container>
