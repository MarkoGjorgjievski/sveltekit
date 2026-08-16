import { expect, test } from '@playwright/test';

const POST_TITLE = 'Accessible combobox from scratch';
const POST_PATH = '/en/blog/accessible-combobox-from-scratch';

test('typing replaces history instead of stacking an entry per keystroke', async ({ page }) => {
	// Two real entries first, so Back has somewhere to land that is not about:blank. Without a
	// page before the search route this assertion could not distinguish replace from push.
	await page.goto('/en/blog');
	await page.goto('/en/search');

	const searchbox = page.getByRole('searchbox', { name: 'Search posts' });

	// Two separate bursts, each past the 250ms debounce, so two navigations genuinely commit.
	await searchbox.fill('access');
	await expect(page).toHaveURL(/q=access/);
	await searchbox.fill('combobox');
	await expect(page).toHaveURL(/q=combobox/);
	await expect(page.getByRole('article')).toHaveCount(1);

	// Both committed states replaced the search entry rather than stacking on it, so one Back
	// leaves the route entirely. Were typing pushing, this would land on ?q=access.
	await page.goBack();
	await expect(page).toHaveURL(/\/en\/blog$/);
});

test('a facet change pushes, so Back returns to the pre-facet state', async ({ page }) => {
	await page.goto('/en/search?q=combobox');
	await expect(page.getByRole('article')).toHaveCount(1);

	await page.getByRole('link', { name: 'Accessibility' }).click();
	await expect(page).toHaveURL(/tag=accessibility/);
	// The tag narrows the current search rather than discarding it.
	await expect(page).toHaveURL(/q=combobox/);

	await page.goBack();
	await expect(page).toHaveURL(/q=combobox/);
	await expect(page).not.toHaveURL(/tag=/);
});

test('a shared search URL renders the same results server-side', async ({ page }) => {
	await page.goto('/en/search?q=combobox&sort=relevance');
	await expect(page.getByRole('heading', { name: POST_TITLE })).toBeVisible();
});

test('search leads to a post carrying Article structured data', async ({ page }) => {
	await page.goto('/en/search?q=combobox');
	await page.getByRole('link', { name: POST_TITLE }).click();
	await expect(page).toHaveURL(POST_PATH);

	const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
	// The post emits a top-level ARRAY — Article plus BreadcrumbList — so the type lives on the
	// entries, not on the parsed root. Asserting root['@type'] would read undefined and a
	// toBe('Article') against it would fail for the wrong reason.
	const parsed: unknown = JSON.parse(jsonLd ?? 'null');
	expect(Array.isArray(parsed)).toBe(true);

	const types = (parsed as Array<{ '@type'?: string }>).map((entry) => entry['@type']);
	expect(types).toContain('Article');
	expect(types).toContain('BreadcrumbList');
});

test('unprefixed post URLs redirect rather than 404', async ({ page }) => {
	const response = await page.goto('/blog/accessible-combobox-from-scratch');
	expect(response?.status()).toBe(200);
	await expect(page).toHaveURL(POST_PATH);
});

test('an unknown path renders the custom error page', async ({ page }) => {
	const response = await page.goto('/en/blog/no-such-post');
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible();
});
