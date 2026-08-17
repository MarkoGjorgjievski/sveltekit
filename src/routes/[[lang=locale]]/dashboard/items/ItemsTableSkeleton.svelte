<script lang="ts">
	import Skeleton from '$lib/ui/Skeleton.svelte';

	interface Props {
		rows: number;
	}

	let { rows }: Props = $props();

	// The real table streams in as a whole (thead included) once `data.result` resolves, so this
	// skeleton has to reserve the header's height too, not just the body rows — otherwise the
	// header appearing late would itself cause the shift streaming was meant to avoid.
	const placeholders = $derived(Array.from({ length: rows }, (_, index) => index));
</script>

<!--
	Mirrors the real table exactly: same `table-fixed` layout, same column widths, same cell
	padding. A skeleton whose dimensions differ from the content it replaces *causes* the layout
	shift streaming was meant to avoid.

	The whole table is `aria-hidden`: it carries no information, only shape, so assistive tech
	should skip it entirely rather than announce empty header/data cells row after row. A separate
	live region (rendered alongside this component) tells screen-reader users loading is in
	progress.
-->
<!-- Same overflow/min-width shape as the real table, so the placeholder occupies the same box
     rather than reflowing the moment real rows arrive. No tabindex here: the skeleton is
     aria-hidden and must not become a keyboard stop. -->
<div class="overflow-x-auto">
	<table aria-hidden="true" class="w-full min-w-[68rem] table-fixed border-collapse">
		<colgroup>
			<col class="w-[70%]" />
			<col class="w-[30%]" />
		</colgroup>
		<thead>
			<tr class="border-b border-border">
				<th class="px-4 py-3 text-left"><Skeleton height="1.25rem" width="8rem" /></th>
				<th class="px-4 py-3 text-left"><Skeleton height="1.25rem" width="5rem" /></th>
			</tr>
		</thead>
		<tbody>
			{#each placeholders as row (row)}
				<tr class="border-b border-border">
					<!-- 2rem, not the 1.25rem a text line would take: the real row is sized by the status
				     select (h-8), so a text-height placeholder would under-reserve every row. -->
					<td class="px-4 py-3"><Skeleton height="2rem" width="12rem" /></td>
					<td class="px-4 py-3"><Skeleton height="2rem" width="4rem" /></td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<!--
	Mirrors Pager's own wrapping div (`mt-3 flex flex-col gap-3 sm:flex-row ...`) — a summary-line
	placeholder plus a row of pill-shaped placeholders standing in for the previous/numbered/next
	links. Reserves room for the nav row unconditionally, even though the real Pager only renders
	it when `pageCount > 1`: that is the taller, worst-case shape, and a resolved page with exactly
	one page of results is shorter than reserved, which the region's min-height floor already
	tolerates by design (see table-metrics.ts).
-->
<div
	data-testid="items-skeleton-pager"
	class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
	aria-hidden="true"
>
	<Skeleton height="1.25rem" width="10rem" />
	<div class="flex items-center gap-1">
		<Skeleton height="2rem" width="4rem" />
		<Skeleton height="2rem" width="2rem" />
		<Skeleton height="2rem" width="2rem" />
		<Skeleton height="2rem" width="4rem" />
	</div>
</div>
