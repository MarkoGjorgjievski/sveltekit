/**
 * Pixel heights for one row of the items table and for the "Showing X–Y of Z" summary line,
 * mirrored from the Tailwind classes both `ItemsTableSkeleton` and the real table/summary use
 * (`px-4 py-3` around `text-sm` content — 2 * 0.75rem padding + 1.25rem line-height, plus a 1px
 * `border-b` — for a row; `mt-3` above `text-sm` text for the summary).
 *
 * The resolved results region reserves `min-height` from `reservedResultsHeightPx` so that a
 * shorter resolved state — a filtered/empty result, or the last page when `total % perPage !==
 * 0` — cannot shrink the page below what the loading skeleton occupied.
 *
 * `ItemsTableSkeleton` does NOT import this module — it renders `rows` placeholder rows with its
 * own Tailwind classes, so these constants are transcribed by hand from those same classes, not
 * derived from a shared source. A hand transcription can silently drift from what actually
 * renders (change `py-3` on one side and not the other, and this file would never know). What
 * keeps that honest is ItemsTableSkeleton.svelte.spec.ts's height-measurement test, which renders
 * the real component, measures it with `getBoundingClientRect()`, and asserts the result against
 * `ROW_HEIGHT_PX` — so a drift between the classes and these constants fails a test instead of
 * silently reintroducing the layout shift streaming exists to avoid.
 */
export const ROW_HEIGHT_PX = 45; // py-3 (24px) + text-sm line-height (20px) + border-b (1px)
export const SUMMARY_HEIGHT_PX = 32; // mt-3 (12px) + text-sm line-height (20px)

/** Header row + `rows` body rows + the summary line beneath the table. */
export function reservedResultsHeightPx(rows: number): number {
	return ROW_HEIGHT_PX * (rows + 1) + SUMMARY_HEIGHT_PX;
}
