import { expect, test } from '@playwright/test';
import { signIn } from './support/login';

// Baselines are generated inside the pinned Playwright Linux image by scripts/snapshots.sh so
// they match CI. Font rasterisation and antialiasing differ enough between Windows and Linux that
// a locally produced PNG never matches one taken on the runner, so rather than committing a
// baseline that only one machine can satisfy, this file only runs where the committed one applies.
test.skip(
	() => process.platform !== 'linux',
	'visual baselines are generated on linux — run scripts/snapshots.sh'
);

test('the open status combobox matches its baseline', async ({ page }) => {
	await signIn(page, 'editor@demo.test');
	await page.goto('/en/dashboard/items');
	await expect(page.getByRole('table')).toBeVisible();

	// exact: true — every row's status <select> is also a combobox, and Playwright matches the
	// accessible name by substring.
	await page.getByRole('combobox', { name: 'Status', exact: true }).click();

	const listbox = page.getByRole('listbox', { name: 'Status', exact: true });
	await expect(listbox).toBeVisible();

	// Scoped to the listbox rather than the page: a full-page shot of this route would repaint on
	// any copy or row change and fail for reasons that have nothing to do with the widget.
	//
	// The facet counts are masked because the authenticated suite edits statuses and runs before
	// this file alphabetically, against the same in-memory store — an unmasked baseline would go
	// red on CI over "Draft 23" now reading 22. What this pins is the widget's chrome: its
	// dimensions, option rows, spacing and palette.
	await expect(listbox).toHaveScreenshot('combobox-open.png', {
		animations: 'disabled',
		mask: [listbox.getByTestId('option-count')]
	});
});
