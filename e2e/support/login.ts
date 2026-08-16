import { expect, type Page } from '@playwright/test';

// All three demo accounts share this password; the fixtures set no other.
const PASSWORD = 'demo1234';

/**
 * Signs in and waits for the dashboard to actually render.
 *
 * Waiting on the URL alone would return while the items table is still streaming, so a caller's
 * first locator would race the skeleton. The login action redirects to `redirectTo` when the
 * caller was bounced off a guarded page, and to the items list otherwise.
 */
export async function signIn(page: Page, email: string) {
	await page.goto('/en/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.waitForURL('**/dashboard/items');
	await expect(page.getByRole('table')).toBeVisible();
}
