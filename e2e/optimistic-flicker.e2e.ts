import { expect, test } from '@playwright/test';
import { signIn } from './support/login';

/**
 * The status cell must never flash the pre-edit value back onto the screen.
 *
 * This can only be caught end to end. The write is answered a full round trip before the read that
 * refreshes the row, and the component tests hold `item` still, so neither half of the suite can
 * see the gap between them. Releasing the optimistic override when the write returns — which is
 * what the first version did — falls back to an `item.status` that is still the old value, and the
 * cell showed: paused (26ms) -> active (42ms) -> paused (296ms). The middle frame is the bug, and
 * it grows with real network latency, so it is far more visible deployed than locally.
 *
 * Sampling every animation frame rather than polling from Node: a two-frame flash is invisible to
 * any assertion that only looks at the settled state.
 */
test('the status cell never shows the old value between the write and the refresh', async ({
	page
}) => {
	await signIn(page, 'editor@demo.test');

	const select = page.locator('select[data-testid^="status-"]').first();
	const testId = await select.getAttribute('data-testid');
	const before = await select.inputValue();
	const next = before === 'paused' ? 'active' : 'paused';

	await page.evaluate((id) => {
		const el = document.querySelector(`select[data-testid="${id}"]`) as HTMLSelectElement;
		const seen: string[] = [];
		const start = performance.now();
		const tick = () => {
			if (seen[seen.length - 1] !== el.value) seen.push(el.value);
			if (performance.now() - start < 4000) requestAnimationFrame(tick);
		};
		(window as unknown as { __seen: string[] }).__seen = seen;
		requestAnimationFrame(tick);
	}, testId);

	await select.selectOption(next);

	// Long enough to cover the action, the invalidation and the load's own simulated latency.
	await page.waitForTimeout(2500);

	const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);

	// Every frame after the user's choice must show that choice. The starting value may appear
	// first — the recorder begins before the click — but it must never come back afterwards.
	expect(seen[seen.length - 1]).toBe(next);
	expect(seen.slice(seen.indexOf(next))).toEqual([next]);

	// And the value is real, not just optimistic: it survives a reload.
	await page.reload();
	await expect(page.getByTestId(testId!)).toHaveValue(next);
});
