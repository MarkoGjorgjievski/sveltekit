import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	// A full build prerenders ~50 pages before preview can answer, and it is measured at 2m17s
	// on a Windows dev machine. Playwright's 60s default expires mid-build and reports it as a
	// server that never came up; even 180s was not enough headroom.
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		timeout: 300_000,
		reuseExistingServer: !process.env.CI
	},
	use: {
		baseURL: 'http://localhost:4173',
		// hooks.server.ts picks the redirect target for an unprefixed path from Accept-Language.
		// Pinning the context locale keeps that choice deterministic instead of inheriting whatever
		// language the machine running the suite happens to prefer.
		locale: 'en-US',
		trace: 'retain-on-failure'
	},
	forbidOnly: !!process.env.CI,
	// No retries on purpose: a test that only passes on the second run is a finding, not noise.
	retries: 0,
	projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']]
});
