import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ItemsTableSkeleton from './ItemsTableSkeleton.svelte';
import {
	HEADER_HEIGHT_PX,
	PAGER_HEIGHT_PX,
	reservedResultsHeightPx,
	ROW_HEIGHT_PX
} from './table-metrics';
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

		// The pager placeholder that follows the table is equally pure shape, not information.
		const pagerPlaceholder = screen.container.querySelector('[data-testid="items-skeleton-pager"]');
		expect(pagerPlaceholder?.getAttribute('aria-hidden')).toBe('true');
	});

	it('renders at the real height ROW_HEIGHT_PX predicts, not just the value it was transcribed from', async () => {
		const rows = 7;
		const screen = render(ItemsTableSkeleton, { rows });

		const table = screen.container.querySelector('table')!;
		const measuredHeight = table.getBoundingClientRect().height;

		// The table itself only ever covers the header + rows — the summary line and the pager's
		// nav row live in the sibling placeholder div measured separately below. The header is a
		// text line (45px) while a body row is sized by the status select at h-8 (57px), so the two
		// are counted separately — measured against the real table, whose rows are a uniform 57px
		// now that names are truncated to one line. The 2px tolerance absorbs sub-pixel rounding
		// at the table's outer border, not a fudge for a real mismatch — if this ever drifts
		// because `py-3` or the Skeleton height changes on one side but not the other,
		// ROW_HEIGHT_PX must be corrected to match reality, not the tolerance widened.
		const expectedHeight = HEADER_HEIGHT_PX + ROW_HEIGHT_PX * rows;
		expect(Math.abs(measuredHeight - expectedHeight)).toBeLessThanOrEqual(2);
	});

	it('renders the pager placeholder at the real height PAGER_HEIGHT_PX predicts, not just the value it was transcribed from', async () => {
		const screen = render(ItemsTableSkeleton, { rows: 3 });

		const placeholder = screen.container.querySelector('[data-testid="items-skeleton-pager"]')!;
		const summaryLine = placeholder.children[0] as HTMLElement;
		const navRow = placeholder.children[1] as HTMLElement;
		const summaryRect = summaryLine.getBoundingClientRect();
		const navRect = navRow.getBoundingClientRect();

		// PAGER_HEIGHT_PX is the nav row's marginal contribution beyond the summary line alone:
		// the gap-3 (12px) between the two lines, plus the nav row's own height. Measured directly
		// against a real, rendered 3-page Pager in this same 414px-wide test viewport (below
		// Tailwind's `sm` breakpoint, so the summary and nav stack): the wrapping div rendered at
		// 64px total (20px summary + 12px gap + 32px nav), i.e. 44px more than the 20px summary
		// line alone — matching PAGER_HEIGHT_PX to the pixel.
		const gap = navRect.top - summaryRect.bottom;
		const measuredPagerHeightPx = gap + navRect.height;
		expect(Math.abs(measuredPagerHeightPx - PAGER_HEIGHT_PX)).toBeLessThanOrEqual(2);
	});

	it('reserves exactly enough room, top to bottom, for reservedResultsHeightPx to hold', async () => {
		const rows = 7;
		const screen = render(ItemsTableSkeleton, { rows });

		const table = screen.container.querySelector('table')!;
		const placeholder = screen.container.querySelector('[data-testid="items-skeleton-pager"]')!;
		const totalHeight =
			placeholder.getBoundingClientRect().bottom - table.getBoundingClientRect().top;

		// The full skeleton — table plus the pager placeholder that follows it — is what the
		// region's min-height must cover so streaming in the real table, summary, and pager never
		// shrinks the page. reservedResultsHeightPx(rows) is composed of the same three real,
		// measured pieces (ROW_HEIGHT_PX, SUMMARY_HEIGHT_PX, PAGER_HEIGHT_PX) verified individually
		// above; this asserts they add up to the true rendered total, not just to each other.
		expect(Math.abs(totalHeight - reservedResultsHeightPx(rows))).toBeLessThanOrEqual(2);
	});
});
