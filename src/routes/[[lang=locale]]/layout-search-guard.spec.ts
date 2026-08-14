import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Lint-style guard, not a substitute for `npm run build`. A unit test cannot reproduce the
// "Cannot access url.search on a page with prerendering enabled" failure — that only appears
// during a real prerender, which is what the CI `build` job actually exercises. This just fails
// fast and locally if the shell layout regresses to reading `page.url.search` unguarded, which
// previously broke every prerendered route (both landing pages, the blog index and pager, all
// forty post pages, and the sitemap).
const layoutPath = fileURLToPath(new URL('./+layout.svelte', import.meta.url));

describe('shell layout url.search guard', () => {
	test('every page.url.search reference is guarded by a browser check on the same line', () => {
		const source = readFileSync(layoutPath, 'utf-8');
		const lines = source.split('\n');
		const searchLines = lines.filter((line) => line.includes('page.url.search'));

		expect(searchLines.length).toBeGreaterThan(0);

		for (const line of searchLines) {
			expect(line).toContain('browser');
		}
	});
});
