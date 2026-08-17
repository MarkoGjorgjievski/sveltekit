import { expect, test } from '@playwright/test';
import { signIn } from './support/login';

test('the dashboard is reachable by clicking, from a cold anonymous visit', async ({ page }) => {
	// The gap this covers: every dashboard route existed and worked, but nothing on the public site
	// linked to any of them, so the only way in was typing a URL.
	await page.goto('/en');

	await page.getByRole('navigation').first().getByRole('link', { name: 'Dashboard' }).click();

	// Anonymous, so the guard bounces to login — carrying where the user was trying to go.
	await expect(page).toHaveURL(/\/en\/login\?redirectTo=/);

	await page.getByLabel('Email').fill('editor@demo.test');
	await page.getByLabel('Password').fill('demo1234');
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page).toHaveURL(/\/en\/dashboard\/items/);
	await expect(page.getByRole('table')).toBeVisible();
});

test('the dashboard links between its own pages', async ({ page }) => {
	await signIn(page, 'editor@demo.test');
	await page.goto('/en/dashboard');

	// The index used to show a name and a role and link nowhere.
	await page
		.getByRole('navigation', { name: 'Dashboard' })
		.getByRole('link', { name: 'Campaigns' })
		.click();
	await expect(page).toHaveURL(/\/en\/dashboard\/items$/);
	await expect(page.getByRole('table')).toBeVisible();

	await page
		.getByRole('navigation', { name: 'Dashboard' })
		.getByRole('link', { name: 'Dashboard' })
		.click();
	await expect(page).toHaveURL(/\/en\/dashboard$/);
});

test('signing out returns to a public page and re-guards the dashboard', async ({ page }) => {
	await signIn(page, 'editor@demo.test');
	await page.getByRole('button', { name: 'Sign out' }).click();

	await page.goto('/en/dashboard/items');
	await expect(page).toHaveURL(/\/en\/login/);
});
