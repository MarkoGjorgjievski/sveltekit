import { expect, test, type Page } from '@playwright/test';

/** Loads the landing page with sampling forced on and flushes the queue. */
async function collectVitals(page: Page) {
	// ?rum forces this session past the 10% sample so the path runs without a lucky roll.
	await page.goto('/en?rum=1');

	// web-vitals reports TTFB shortly after activation. Flushing the instant the page loads finds
	// an empty queue and sends nothing — the beacon is not lost, it simply has not happened yet.
	await page.waitForTimeout(900);

	// The flush trigger. visibilityState is overridden first because the handler reads it, and the
	// event bubbles because the real one does.
	await page.evaluate(() => {
		Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
		document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
	});
}

test('web vitals reach the edge endpoint and are accepted', async ({ page }) => {
	const statuses: number[] = [];
	page.on('response', (response) => {
		if (response.url().includes('/api/rum')) statuses.push(response.status());
	});

	await collectVitals(page);

	await expect.poll(() => statuses.length, { timeout: 5000 }).toBeGreaterThan(0);
	expect(statuses.every((status) => status === 204)).toBe(true);
});

test('the beacon payload carries a vital and one session id', async ({ page }) => {
	// Playwright cannot read the body of a sendBeacon request — both postData() and
	// postDataBuffer() are null for its Blob payload. Making sendBeacon report failure routes the
	// queue down the documented keepalive-fetch fallback, whose body is readable, so this asserts
	// the payload and covers the fallback transport in the same pass.
	await page.addInitScript(() => {
		navigator.sendBeacon = () => false;
	});

	const sent: { kind?: string; name?: string; sessionId?: string; rating?: string }[] = [];
	page.on('request', (request) => {
		if (request.url().includes('/api/rum') && request.method() === 'POST') {
			const body = request.postDataBuffer()?.toString('utf8') ?? request.postData();
			if (body) sent.push(JSON.parse(body));
		}
	});

	await collectVitals(page);
	await expect.poll(() => sent.length, { timeout: 5000 }).toBeGreaterThan(0);

	const vitals = sent.filter((beacon) => beacon.kind === 'vital');
	expect(vitals.length).toBeGreaterThan(0);

	// Only TTFB is assertable here: headless Chromium emits no paint timings at all
	// (performance.getEntriesByType('paint') is empty), so FCP and LCP never fire and CLS/INP have
	// nothing to observe. Driven headed, all five report and all five are accepted with 204.
	expect(vitals.map((beacon) => beacon.name)).toContain('TTFB');
	expect(vitals.every((beacon) => typeof beacon.rating === 'string')).toBe(true);

	// One id across every beacon in the session — that is what makes percentiles attributable to a
	// real user rather than a blend of several.
	expect(new Set(vitals.map((beacon) => beacon.sessionId)).size).toBe(1);
});

test('the endpoint refuses a malformed beacon', async ({ request }) => {
	const bad = await request.post('/api/rum', { data: { kind: 'vital', name: 'FID' } });
	expect(bad.status()).toBe(400);

	const good = await request.post('/api/rum', {
		data: {
			kind: 'vital',
			name: 'LCP',
			value: 1200,
			rating: 'good',
			path: '/en',
			sessionId: 'e2e-session'
		}
	});
	expect(good.status()).toBe(204);
});
