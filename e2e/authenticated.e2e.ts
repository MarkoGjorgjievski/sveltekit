import { expect, type Locator, type Page, test } from '@playwright/test';
import { signIn } from './support/login';

/** The first status control in the table, plus the row it belongs to and that row's name. */
async function firstEditableRow(page: Page) {
	const select = page.getByTestId(/^status-cmp_/).first();
	await expect(select).toBeVisible();

	const testId = await select.getAttribute('data-testid');
	if (!testId) throw new Error('status control is missing its data-testid');

	const row = page.getByRole('row').filter({ has: page.getByTestId(testId) });
	const name = (await row.getByRole('rowheader').innerText()).trim();

	return { select, testId, name };
}

// Several polite live regions share this page — the streamed table announces "Loading…" and
// each combobox announces its result count — so getByRole('status') resolves to five elements
// and fails Playwright's strict mode. The toast region carries a test id to stay addressable as
// more live regions appear.
function toastRegion(page: Page) {
	return page.getByTestId('toast-region');
}

/** The status control is disabled for a viewer; re-enable it the way a determined user would. */
async function forceEnable(select: Locator) {
	await select.evaluate((node: HTMLSelectElement) => node.removeAttribute('disabled'));
}

test('anonymous users are redirected to login and returned afterwards', async ({ page }) => {
	await page.goto('/en/dashboard/items?status=active');
	await expect(page).toHaveURL(/\/en\/login\?redirectTo=/);

	await page.getByLabel('Email').fill('editor@demo.test');
	await page.getByLabel('Password').fill('demo1234');
	await page.getByRole('button', { name: 'Sign in' }).click();

	// The query the user was originally asking for survives the round trip, not just the pathname.
	await expect(page).toHaveURL(/\/en\/dashboard\/items\?status=active/);
	await expect(page.getByRole('table')).toBeVisible();
});

test('an editor edit is confirmed and survives a fresh navigation', async ({ page }) => {
	await signIn(page, 'editor@demo.test');
	await page.goto('/en/dashboard/items?status=draft&sort=name&dir=asc');

	const { select, testId, name } = await firstEditableRow(page);
	await select.selectOption('active');

	await expect(toastRegion(page)).toContainText(/saved/i);

	// Re-read the row by NAME rather than by re-applying a status filter and hoping the row lands
	// on the first page of it. The write is what this asserts; which page a 72-row filter puts the
	// row on is not, and `perPage` arithmetic would make the test fail for an unrelated reason.
	const params = new URLSearchParams({ q: name, status: 'active' });
	await page.goto(`/en/dashboard/items?${params}`);
	await expect(page.getByTestId(testId)).toHaveValue('active');
});

test('a viewer edit rolls back with the role message', async ({ page }) => {
	await signIn(page, 'viewer@demo.test');
	await page.goto('/en/dashboard/items?status=draft&sort=name&dir=asc');

	const { select } = await firstEditableRow(page);
	// Disabling the control is a courtesy; the server refusing the POST is the security boundary.
	// Re-enabling it here is what makes this a test of the boundary rather than of the courtesy.
	await expect(select).toBeDisabled();
	await forceEnable(select);

	await select.selectOption('active');

	await expect(toastRegion(page)).toContainText(/role cannot edit/i);
	await expect(select).toHaveValue('draft');
});

test('archived rows refuse edits with distinct copy', async ({ page }) => {
	await signIn(page, 'editor@demo.test');
	await page.goto('/en/dashboard/items?status=archived&sort=name&dir=asc');

	const { select } = await firstEditableRow(page);
	// An editor may edit; this row may not be edited. Different reason, different message —
	// collapsing it into the role failure would tell the user to go find a permission they have.
	await select.selectOption('active');

	await expect(toastRegion(page)).toContainText(/archived campaigns cannot/i);
	await expect(select).toHaveValue('archived');
});

test('sorting keeps the filter and resets the page', async ({ page }) => {
	await signIn(page, 'editor@demo.test');
	await page.goto('/en/dashboard/items?status=active&page=3');

	await page.getByRole('link', { name: 'Budget' }).click();

	await expect(page).toHaveURL(/sort=budget/);
	await expect(page).toHaveURL(/status=active/);
	// Page 3 of a name-ordered list is an arbitrary slice of a budget-ordered one.
	await expect(page).not.toHaveURL(/page=3/);
});
