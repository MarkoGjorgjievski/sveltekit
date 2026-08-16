import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { signIn } from './support/login';

const BLOCKING_IMPACTS = ['serious', 'critical'];

/**
 * Violations reduced to `id: n node(s)`.
 *
 * Asserting on the raw violation objects dumps axe's full node payload — every selector, every
 * HTML snippet, every remediation URL — into the failure output, which buries the one line that
 * says what actually broke.
 */
function summarize(violations: { id: string; nodes: unknown[] }[]) {
	return violations.map((violation) => `${violation.id}: ${violation.nodes.length} node(s)`);
}

async function audit(page: Page, tags: string[]) {
	return new AxeBuilder({ page }).withTags(tags).analyze();
}

test('the landing page has no serious or critical violations', async ({ page }) => {
	await page.goto('/en');

	const results = await audit(page, ['wcag2a', 'wcag2aa']);
	const blocking = results.violations.filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ''));

	expect(summarize(blocking)).toEqual([]);
});

test('the dashboard table has no serious or critical violations', async ({ page }) => {
	await signIn(page, 'editor@demo.test');
	await page.goto('/en/dashboard/items');
	// Waiting out the streamed skeleton is load-bearing: axe run against the placeholder audits
	// markup with no table, no controls and no real text, and passes for the wrong reason.
	await expect(page.getByRole('table')).toBeVisible();

	const results = await audit(page, ['wcag2a', 'wcag2aa']);
	const blocking = results.violations.filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ''));

	expect(summarize(blocking)).toEqual([]);
	expect([...new Set(results.incomplete.map((i) => i.id))].sort()).toEqual(KNOWN_INCOMPLETE);
});

// Rules axe cannot decide, checked by hand and both benign:
//   aria-valid-attr-value — 'cannot determine if aria-controls target exists while using
//     aria-haspopup'. The listbox IS always rendered (inside a hidden wrapper) precisely so the
//     reference never dangles; axe declines to confirm it, which is a known limitation.
//   color-contrast — the sort arrow span, which is aria-hidden and 'contains only non-text
//     characters'.
// Pinned as a set because an incomplete result is a blind spot, not a pass: a NEW undecidable
// rule could be hiding a real violation and deserves a human look. If this fails, read the new
// entry, confirm it is benign, and add it here.
const KNOWN_INCOMPLETE = ['aria-valid-attr-value', 'color-contrast'];

test('the dashboard keeps contrast in dark mode', async ({ page }) => {
	await signIn(page, 'editor@demo.test');
	// The theme is a cookie that hooks.server.ts reads back into the html tag, so this exercises
	// the real dark palette rather than a class toggled after paint.
	await page.context().addCookies([{ name: 'theme', value: 'dark', url: 'http://localhost:4173' }]);
	await page.goto('/en/dashboard/items');
	await expect(page.getByRole('table')).toBeVisible();

	const results = await audit(page, ['wcag2aa']);

	// Scoped to contrast on purpose: this test exists for the token pair that reads fine in light
	// mode and fails AA once the dark values are swapped in. Everything else is already covered
	// above and would just duplicate failures here.
	expect(summarize(results.violations.filter((v) => v.id === 'color-contrast'))).toEqual([]);
});

test('the open combobox is reachable and labelled', async ({ page }) => {
	await signIn(page, 'editor@demo.test');
	await page.goto('/en/dashboard/items');
	await expect(page.getByRole('table')).toBeVisible();

	// exact: true is required, not tidiness — Playwright matches the accessible name by
	// SUBSTRING, and every row status <select> is itself a combobox named "Edit status for <row>".
	// Without it this resolves to 26 elements.
	await page.getByRole('combobox', { name: 'Status', exact: true }).click();
	await expect(page.getByRole('listbox', { name: 'Status', exact: true })).toBeVisible();

	// The listbox only exists once opened, so the audits above never see it. This is the composite
	// widget built by hand in Task 17 and the most likely place for an ARIA mistake to hide.
	const results = await audit(page, ['wcag2a', 'wcag2aa']);
	const blocking = results.violations.filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ''));

	expect(summarize(blocking)).toEqual([]);
});
