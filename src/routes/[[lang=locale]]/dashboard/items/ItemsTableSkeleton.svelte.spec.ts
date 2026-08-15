import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ItemsTableSkeleton from './ItemsTableSkeleton.svelte';
import { reservedResultsHeightPx, ROW_HEIGHT_PX, SUMMARY_HEIGHT_PX } from './table-metrics';
// A component rendered standalone via `render()` gets no global stylesheet — Tailwind's compiled
// CSS is only injected into a document when something in the module graph imports it. Without
// this import, `border-collapse`, `px-4`/`py-3`, etc. never apply and every measurement below
// would silently fall back to raw UA table defaults (border-collapse: separate, 1px cell padding,
// 2px border-spacing) instead of the real rendered layout — verified by running this test with
// and without the import: the same probe reported a 194px table without it, 360px with it, for
// the same 7 rows.
import '../../../layout.css';

describe('ItemsTableSkeleton', () => {
	it('renders exactly the requested number of placeholder rows', async () => {
		const screen = render(ItemsTableSkeleton, { rows: 7 });

		const rows = screen.container.querySelectorAll('tbody tr');
		expect(rows).toHaveLength(7);
	});

	it('renders a different row count when asked for one', async () => {
		const screen = render(ItemsTableSkeleton, { rows: 3 });

		const rows = screen.container.querySelectorAll('tbody tr');
		expect(rows).toHaveLength(3);
	});

	it('is hidden from the accessibility tree — it carries shape, not information', async () => {
		const screen = render(ItemsTableSkeleton, { rows: 5 });

		const table = screen.container.querySelector('table');
		expect(table?.getAttribute('aria-hidden')).toBe('true');
	});

	it('renders at the real height ROW_HEIGHT_PX predicts, not just the value it was transcribed from', async () => {
		const rows = 7;
		const screen = render(ItemsTableSkeleton, { rows });

		const table = screen.container.querySelector('table')!;
		const measuredHeight = table.getBoundingClientRect().height;

		// reservedResultsHeightPx(rows) covers the whole reserved region — header + rows + the
		// summary line beneath the table — but ItemsTableSkeleton only ever renders the header and
		// rows; it has no placeholder for the summary line (that gap is covered by the *container's*
		// min-height alone, asserted separately in page.svelte.spec.ts). So the number this skeleton
		// can actually be measured against is the reservation minus SUMMARY_HEIGHT_PX, i.e.
		// ROW_HEIGHT_PX * (rows + 1). Measured directly: 7 rows render at exactly 360px (45px each,
		// including the header row), which matches ROW_HEIGHT_PX * 8 to the pixel — confirmed at a
		// second row count (3 rows -> 180px = ROW_HEIGHT_PX * 4) to rule out coincidence. The 2px
		// tolerance absorbs sub-pixel rounding at the table's outer border, not a fudge for a real
		// mismatch — if this ever drifts because `py-3` or the Skeleton height changes on one side
		// but not the other, ROW_HEIGHT_PX must be corrected to match reality, not the tolerance
		// widened.
		const expectedHeight = reservedResultsHeightPx(rows) - SUMMARY_HEIGHT_PX;
		expect(expectedHeight).toBe(ROW_HEIGHT_PX * (rows + 1));
		expect(Math.abs(measuredHeight - expectedHeight)).toBeLessThanOrEqual(2);
	});
});
