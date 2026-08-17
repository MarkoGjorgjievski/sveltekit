/**
 * Post-deploy smoke test.
 *
 *   npm run smoke -- https://your-deployment.vercel.app
 *
 * Checks the things that only break once the app is actually deployed: the origin baked into
 * prerendered pages, the guard on the authenticated area, the edge endpoint's contract, and the
 * build-time OG images. Unit and e2e suites cannot see any of these — they run against a local
 * preview whose origin is localhost and whose runtime is one Node process.
 *
 * Exits non-zero on the first failed expectation so it can gate a release.
 */

const DEMO = { email: 'editor@demo.test', password: 'demo1234' };
const POST_SLUG = 'accessible-combobox-from-scratch';

const base = (process.argv[2] ?? process.env.SMOKE_URL ?? '').replace(/\/$/, '');
if (!base) {
	console.error('Usage: npm run smoke -- https://your-deployment.vercel.app');
	process.exit(2);
}

const results = [];

function check(name, ok, detail = '') {
	results.push({ name, ok, detail });
	const mark = ok ? '[32mPASS[0m' : '[31mFAIL[0m';
	console.log(`${mark}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/** Never follows redirects: several checks below are *about* the redirect. */
function get(path, headers = {}) {
	return fetch(`${base}${path}`, { redirect: 'manual', headers });
}

async function run() {
	console.log(`Smoke testing ${base}\n`);

	// --- public surface -----------------------------------------------------------------------
	const root = await get('/');
	check(
		'/ redirects to a locale',
		root.status === 308 && /^\/(en|de)/.test(root.headers.get('location') ?? ''),
		`${root.status} -> ${root.headers.get('location')}`
	);

	const landing = await get('/en');
	const landingHtml = await landing.text();
	check('/en serves 200', landing.status === 200, String(landing.status));

	// The one that only a real deployment can catch: PUBLIC_SITE_URL is consumed at BUILD time, so
	// a build without it bakes localhost into every canonical, hreflang, sitemap entry and og:image.
	const canonical = landingHtml.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? '';
	check(
		'canonical points at the deployment, not localhost',
		canonical.startsWith(base),
		canonical || '(no canonical found)'
	);

	const blog = await get('/en/blog');
	check('/en/blog serves 200', blog.status === 200, String(blog.status));

	const unprefixed = await get(`/blog/${POST_SLUG}`);
	check(
		'unprefixed post URL redirects rather than 404s',
		[301, 302, 307, 308].includes(unprefixed.status),
		`${unprefixed.status} -> ${unprefixed.headers.get('location')}`
	);

	const missing = await get('/en/blog/no-such-post');
	check('unknown post returns 404', missing.status === 404, String(missing.status));

	const sitemap = await get('/sitemap.xml');
	const sitemapXml = await sitemap.text();
	check(
		'sitemap is served and free of placeholder origins',
		sitemap.status === 200 &&
			sitemapXml.includes(base) &&
			!/localhost|sveltekit-prerender/.test(sitemapXml),
		String(sitemap.status)
	);

	const robots = await get('/robots.txt');
	check('robots.txt is served', robots.status === 200, String(robots.status));

	// --- open graph images (prerendered at build) ---------------------------------------------
	for (const locale of ['en', 'de']) {
		const og = await get(`/og/${locale}/${POST_SLUG}.png`);
		const buffer = Buffer.from(await og.arrayBuffer());
		const isPng = buffer.subarray(1, 4).toString() === 'PNG';
		const width = isPng ? buffer.readUInt32BE(16) : 0;
		const height = isPng ? buffer.readUInt32BE(20) : 0;
		check(
			`/og/${locale}/… is a real 1200x630 PNG`,
			og.status === 200 && isPng && width === 1200 && height === 630,
			`${og.status} ${width}x${height} ${buffer.length}B`
		);
	}

	// --- the guarded area ----------------------------------------------------------------------
	const guarded = await get('/en/dashboard/items');
	check(
		'dashboard redirects an anonymous visitor to login',
		guarded.status === 303 && (guarded.headers.get('location') ?? '').includes('/login'),
		`${guarded.status} -> ${guarded.headers.get('location')}`
	);

	const login = await fetch(`${base}/en/login`, {
		method: 'POST',
		redirect: 'manual',
		headers: { 'content-type': 'application/x-www-form-urlencoded', origin: base },
		body: new URLSearchParams({ email: DEMO.email, password: DEMO.password })
	});
	const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
	check(
		'login issues a session cookie',
		cookie.startsWith('demo_session='),
		cookie ? 'set' : 'none'
	);

	const dashboard = await get('/en/dashboard/items', { cookie });
	const dashboardHtml = await dashboard.text();
	// A prerendered guard redirect answers 200 with a tiny location.href document. Checking the
	// status alone would call that a pass — it is how a dead dashboard shipped once already.
	check(
		'dashboard renders for a signed-in user',
		dashboard.status === 200 && dashboardHtml.includes('<table') && dashboardHtml.length > 5000,
		`${dashboard.status}, ${dashboardHtml.length}B`
	);

	// --- edge endpoint -------------------------------------------------------------------------
	const beacon = (body) =>
		fetch(`${base}/api/rum`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});

	const good = await beacon({
		kind: 'vital',
		name: 'LCP',
		value: 1200,
		rating: 'good',
		path: '/en',
		sessionId: 'smoke'
	});
	check('/api/rum accepts a valid beacon with 204', good.status === 204, String(good.status));

	const bad = await beacon({ kind: 'vital', name: 'FID' });
	check('/api/rum rejects a malformed beacon with 400', bad.status === 400, String(bad.status));

	const failed = results.filter((r) => !r.ok);
	console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
	if (failed.length > 0) {
		console.error(`\nFailed:\n${failed.map((r) => `  - ${r.name}`).join('\n')}`);
		process.exit(1);
	}
}

run().catch((error) => {
	console.error('Smoke run could not complete:', error.message);
	process.exit(1);
});
