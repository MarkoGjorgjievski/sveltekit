import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Skeleton from './Skeleton.svelte';

describe('Skeleton', () => {
	it('is hidden from the accessibility tree and honours reduced motion', async () => {
		const screen = render(Skeleton, { width: '4rem', height: '1rem' });
		const skeleton = screen.container.querySelector('[aria-hidden="true"]');
		expect(skeleton).not.toBeNull();
		expect(skeleton?.className).toContain('motion-reduce:animate-none');
	});
});
