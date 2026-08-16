<script lang="ts">
	import type { Locale } from '$lib/schemas/post';
	import { t } from '$lib/i18n/t';
	import Button from '$lib/ui/Button.svelte';

	interface Props {
		locale: Locale;
		onretry: () => void;
	}

	let { locale, onretry }: Props = $props();
</script>

<!--
	role="alert" so this is announced the moment it mounts. The table failed while the shell, nav
	and filters stayed live (the promise resolved to a Result rather than rejecting), so nothing
	else on the page would otherwise tell an assistive-tech user the data they asked for never
	arrived.
-->
<div
	role="alert"
	class="flex flex-col items-start gap-3 rounded-(--radius-card) bg-danger-surface px-4 py-4 text-sm text-danger-ink sm:flex-row sm:items-center sm:justify-between"
>
	<p>{t(locale, 'common.error')}</p>
	<Button variant="secondary" size="sm" onclick={onretry}>{t(locale, 'common.retry')}</Button>
</div>
