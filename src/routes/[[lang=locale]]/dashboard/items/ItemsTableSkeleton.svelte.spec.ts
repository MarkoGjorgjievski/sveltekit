import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ItemsTableSkeleton from './ItemsTableSkeleton.svelte';

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
});
