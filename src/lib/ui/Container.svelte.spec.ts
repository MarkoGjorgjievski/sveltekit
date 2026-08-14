import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Container from './Container.svelte';

const label = (text: string) => createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('Container', () => {
	it('renders its children within a centered max-width wrapper', async () => {
		const screen = render(Container, { children: label('Page content') });
		await expect.element(screen.getByText('Page content')).toBeInTheDocument();
		expect(screen.container.querySelector('.mx-auto')).not.toBeNull();
	});
});
