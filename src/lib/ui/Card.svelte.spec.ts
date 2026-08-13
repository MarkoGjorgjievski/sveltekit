import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Card from './Card.svelte';

const label = (text: string) => createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('Card', () => {
	it('renders its children inside a token-styled surface', async () => {
		const screen = render(Card, { children: label('Content') });
		await expect.element(screen.getByText('Content')).toBeInTheDocument();
		expect(screen.container.querySelector('.bg-surface')).not.toBeNull();
	});
});
