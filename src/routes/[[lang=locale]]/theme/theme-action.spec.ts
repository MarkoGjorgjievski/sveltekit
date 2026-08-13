import { describe, expect, it } from 'vitest';
import { _isSameOrigin as isSameOrigin } from './+page.server';

const origin = 'http://localhost:5173';

describe('isSameOrigin', () => {
	it('accepts a same-origin relative path', () => {
		expect(isSameOrigin('/en', origin)).toBe(true);
	});

	it('rejects a protocol-relative url that swaps the host', () => {
		expect(isSameOrigin('//evil.com', origin)).toBe(false);
	});

	it('rejects an absolute cross-origin url', () => {
		expect(isSameOrigin('https://evil.com', origin)).toBe(false);
	});

	it('rejects a backslash variant, which browsers treat as protocol-relative', () => {
		// For special schemes (http/https/...), a leading "/\" normalises the same way "//" does,
		// so "/\evil.com" resolves to http://evil.com — a prefix check on "//" alone misses this.
		expect(isSameOrigin('/\\evil.com', origin)).toBe(false);
	});

	it('treats an empty target as the origin root rather than a cross-origin bypass', () => {
		expect(isSameOrigin('', origin)).toBe(true);
	});
});
