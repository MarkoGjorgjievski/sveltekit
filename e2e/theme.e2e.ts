import { expect, test } from '@playwright/test';

const attr = () => document.documentElement.dataset.theme;

test('the toggle swaps theme instantly, without a page load', async ({ page }) => {
	await page.goto('/en');
	expect(await page.evaluate(attr)).toBe('light');

	const toggle = page.getByRole('button', { name: 'Switch to dark theme' });
	await expect(toggle).toBeVisible();

	// A full navigation would reset this; the point of enhancing the form is that none happens.
	await page.evaluate(() => ((window as unknown as { __alive: boolean }).__alive = true));

	await toggle.click();

	await expect.poll(() => page.evaluate(attr)).toBe('dark');
	expect(await page.evaluate(() => (window as unknown as { __alive?: boolean }).__alive)).toBe(
		true
	);

	// The control now describes the opposite action.
	await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
});

test('the choice survives a real page load, so the cookie was written', async ({ page }) => {
	await page.goto('/en');
	await page.getByRole('button', { name: 'Switch to dark theme' }).click();
	await expect.poll(() => page.evaluate(attr)).toBe('dark');

	// Server-rendered from the cookie via transformPageChunk — this is what proves the POST landed
	// rather than the client just repainting itself.
	await page.goto('/en/blog');
	expect(await page.evaluate(attr)).toBe('dark');
});

test('the toggle still works with JavaScript disabled', async ({ browser }) => {
	// The whole reason this stayed a real form posting to a real action. Without JS there is no
	// enhance, so the action's 303 is followed and the theme arrives with the new document.
	//
	// Exercised on /en/search, which is server-rendered. A prerendered page cannot pass this, and
	// it is not a bug to be fixed: its HTML is a static file whose data-theme was written at build
	// time, and with scripting off there is nothing left to apply the cookie. Noted in the README.
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();

	await page.goto('/en/search');
	expect(await page.evaluate(attr)).toBe('light');

	await page.getByRole('button', { name: 'Switch to dark theme' }).click();
	await page.waitForURL('**/en/search');

	expect(await page.evaluate(attr)).toBe('dark');
	await context.close();
});
