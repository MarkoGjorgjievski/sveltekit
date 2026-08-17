// @lhci/cli falls back to puppeteer-core when puppeteer is absent, and puppeteer-core needs an
// explicit browser. Playwright already downloads a Chromium for the e2e suite and vitest's browser
// mode, so this points at that one rather than adding a second ~150 MB browser to the install.
const { chromium } = require('playwright');

const PUBLIC_URLS = 'http://localhost:4173/en($|/blog/)';

// Applied to every audited URL.
const CORE_ASSERTIONS = {
	'categories:performance': ['error', { minScore: 0.95 }],
	'categories:accessibility': ['error', { minScore: 0.95 }],
	'categories:best-practices': ['error', { minScore: 0.95 }],
	'largest-contentful-paint': ['error', { maxNumericValue: 2000 }],
	'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
	// Standing in for INP, which Lighthouse cannot produce in navigation mode — it is a field metric
	// that needs real interactions. Asserting a lab INP number would be inventing a measurement;
	// INP is gated by the RUM beacon instead.
	'total-blocking-time': ['error', { maxNumericValue: 200 }]
};

module.exports = {
	ci: {
		collect: {
			startServerCommand: 'npm run preview',
			startServerReadyPattern: 'Local',
			chromePath: chromium.executablePath(),
			// Playwright applies container-safe flags when it launches Chromium; LHCI drives the same
			// binary through puppeteer, which does not, so Chrome dies during startup wherever the
			// sandbox has nothing to work with. Relaxed only under CI — a local run keeps the sandbox.
			puppeteerLaunchOptions: process.env.CI
				? { args: ['--no-sandbox', '--disable-dev-shm-usage'] }
				: {},
			url: [
				'http://localhost:4173/en',
				'http://localhost:4173/en/blog/accessible-combobox-from-scratch',
				'http://localhost:4173/en/dashboard/items'
			],
			// A single Lighthouse run is noisy enough to fail a build that would pass on a retry.
			numberOfRuns: 3,
			puppeteerScript: './scripts/lhci-login.cjs',
			settings: { preset: 'desktop' }
		},
		assert: {
			assertMatrix: [
				{ matchingUrlPattern: '.*', assertions: CORE_ASSERTIONS },
				{
					// SEO is asserted on the public surface only. The dashboard is deliberately
					// `noindex` — it is behind a session and has nothing to offer a crawler — and
					// Lighthouse scores that 0.54, almost entirely for "page is blocked from indexing".
					// Holding an authenticated page to >=0.95 SEO would mean making it indexable to satisfy
					// the gate, which is the opposite of correct.
					matchingUrlPattern: PUBLIC_URLS,
					assertions: { 'categories:seo': ['error', { minScore: 0.95 }] }
				}
			]
		},
		upload: { target: 'temporary-public-storage' }
	}
};
