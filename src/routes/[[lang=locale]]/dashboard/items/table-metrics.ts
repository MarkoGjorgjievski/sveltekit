/**
 * Pixel heights for one row of the items table, the "Showing X–Y of Z" summary line, and the
 * pager's nav row beneath it — mirrored from the Tailwind classes `ItemsTableSkeleton` and the
 * real table/summary/pager use (`px-4 py-3` around `text-sm` content — 2 * 0.75rem padding +
 * 1.25rem line-height, plus a 1px `border-b` — for a row; `mt-3` above `text-sm` text for the
 * summary; `gap-3` plus the pager's `h-8` links for the nav row that follows it).
 *
 * The resolved results region reserves `min-height` from `reservedResultsHeightPx` so that a
 * shorter resolved state — a filtered/empty result, or the last page when `total % perPage !==
 * 0` — cannot shrink the page below what the loading skeleton occupied.
 *
 * `ItemsTableSkeleton` does NOT import this module — it renders `rows` placeholder rows (and a
 * placeholder summary + pager row) with its own Tailwind classes, so these constants are
 * transcribed by hand from those same classes, not derived from a shared source. A hand
 * transcription can silently drift from what actually renders (change `py-3` on one side and not
 * the other, and this file would never know). What keeps that honest is
 * ItemsTableSkeleton.svelte.spec.ts's height-measurement test, which renders the real component,
 * measures it with `getBoundingClientRect()`, and asserts the result against `ROW_HEIGHT_PX` and
 * `PAGER_HEIGHT_PX` — so a drift between the classes and these constants fails a test instead of
 * silently reintroducing the layout shift streaming exists to avoid.
 *
 * `Pager`'s nav row (previous/numbered/next links) only renders when `pageCount > 1`, and
 * `FilterBar` no longer lives inside the streamed/reserved region at all — it renders above it,
 * built from `data.query`, which resolves synchronously with the page shell and never depends on
 * the streamed promise. The skeleton still always reserves room for the pager's nav row: that is
 * the taller, worst-case shape (a resolved page with `pageCount === 1` is shorter than reserved,
 * which the floor already tolerates by design), not the shape every resolved page takes.
 */
export const ROW_HEIGHT_PX = 45; // py-3 (24px) + text-sm line-height (20px) + border-b (1px)
export const SUMMARY_HEIGHT_PX = 32; // mt-3 (12px) + text-sm line-height (20px)
// gap-3 (12px) between the summary line and the pager's nav row, plus the nav row's own height
// (h-8 links/spans = 32px). Measured directly in a real browser at the test viewport (414px wide,
// below Tailwind's `sm` breakpoint, so the summary and nav stack rather than sitting side by
// side): a 3-page Pager's own wrapping div rendered at 64px total (20px summary + 12px gap + 32px
// nav), confirming 12 + 32 = 44 as the nav row's marginal contribution beyond the summary line
// alone.
export const PAGER_HEIGHT_PX = 44;

/** Header row + `rows` body rows + the summary line + the pager's nav row beneath the table. */
export function reservedResultsHeightPx(rows: number): number {
	return ROW_HEIGHT_PX * (rows + 1) + SUMMARY_HEIGHT_PX + PAGER_HEIGHT_PX;
}
