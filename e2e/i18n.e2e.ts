import { expect, test } from '@playwright/test';

test('switching locale updates the page without a reload', async ({ page }) => {
	await page.goto('/en/search');
	await expect(page.getByLabel('Search posts')).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');

	// Prove no full document load happens: a reload would reset this.
	await page.evaluate(() => ((window as unknown as { __spa: boolean }).__spa = true));

	await page.click('a[hreflang="de"]');
	await expect(page).toHaveURL(/\/de\/search$/);

	// The content itself must change. Every load derived its locale from `locals`, which SvelteKit
	// cannot track, so a navigation that changes nothing but the locale segment re-ran no load and
	// the page kept rendering the previous language until a manual refresh.
	await expect(page.getByLabel('Beiträge durchsuchen')).toBeVisible();
	await expect(
		page.getByRole('navigation').first().getByRole('link', { name: 'Start' })
	).toBeVisible();

	// %lang% is substituted server-side for full documents only, so this needs the client to keep it
	// in step — screen readers and hyphenation read it.
	expect(await page.evaluate(() => document.documentElement.lang)).toBe('de');

	expect(await page.evaluate(() => (window as unknown as { __spa?: boolean }).__spa)).toBe(true);
});

test('switching back returns to the original locale', async ({ page }) => {
	await page.goto('/de/blog');
	await page.click('a[hreflang="en"]');
	await expect(page).toHaveURL(/\/en\/blog$/);
	await expect(
		page.getByRole('navigation').first().getByRole('link', { name: 'Home' })
	).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
});
