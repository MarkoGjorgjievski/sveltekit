import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Prerendered routes get this as url.origin. Without it SvelteKit uses
			// http://sveltekit-prerender, which would ship a sitemap full of a hostname
			// that does not exist. Vercel sets PUBLIC_SITE_URL at build time.
			prerender: { origin: process.env.PUBLIC_SITE_URL ?? 'http://localhost:5173' },
			// The generated tsconfig covers src/, test/ and tests/ — not e2e/, and not the
			// Playwright config itself. Left alone the whole end-to-end suite would sit outside
			// `npm run check` and could ship type errors no gate ever looks at.
			typescript: {
				config: (config) => {
					config.include.push('../e2e/**/*.ts', '../playwright.config.ts');
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
