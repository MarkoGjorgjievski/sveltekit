import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Text from './Text.svelte';

const label = (text: string) => createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('Text', () => {
	it('renders as a paragraph by default', async () => {
		const screen = render(Text, { children: label('Body copy') });
		await expect.element(screen.getByText('Body copy')).toBeInTheDocument();
		expect(screen.container.querySelector('p')).not.toBeNull();
	});

	it('renders the requested heading level', async () => {
		const screen = render(Text, { as: 'h1', children: label('Heading') });
		await expect
			.element(screen.getByRole('heading', { level: 1, name: 'Heading' }))
			.toBeInTheDocument();
	});
});
