// Lighthouse must audit the real dashboard, not the login page.
//
// /en/dashboard/items is behind the route guard in hooks.server.ts, so an unauthenticated audit
// follows a 303 to /en/login and scores a small static form — a great number for a page nobody
// asked about. This signs in first, in the same browser Lighthouse then drives, so the session
// cookie is already set when the audit navigates.
module.exports = async (browser, context) => {
	if (!context.url.includes('/dashboard')) return;

	const page = await browser.newPage();
	try {
		await page.goto('http://localhost:4173/en/login', { waitUntil: 'domcontentloaded' });
		await page.waitForSelector('#email');

		await page.type('#email', 'editor@demo.test');
		await page.type('#password', 'demo1234');

		// Scoped to the form that owns the email field. A bare button[type="submit"] matches the
		// layout's theme toggle first — it sits in the header above this form — so the click toggled
		// the theme, the page re-rendered still logged out, and the audit measured /login instead.
		await Promise.all([
			page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
			page.click('form:has(#email) button[type="submit"]')
		]);

		// Fail loudly rather than letting Lighthouse audit the login page and report a fine score.
		if (page.url().includes('/login')) {
			throw new Error(`Lighthouse login did not take: still at ${page.url()}`);
		}
	} finally {
		await page.close();
	}
};
