import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Button from './Button.svelte';

// createRawSnippet builds a real Snippet, so the children prop typechecks
// without a cast — the global "no any, no assertions to never" rule applies
// to tests too.
const label = (text: string) => createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('Button', () => {
	it('renders an accessible button with its label', async () => {
		const screen = render(Button, { children: label('Save') });
		await expect.element(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
	});

	it('renders an anchor when href is supplied so links stay links', async () => {
		const screen = render(Button, { href: '/en/blog', children: label('Blog') });
		await expect.element(screen.getByRole('link', { name: 'Blog' })).toBeInTheDocument();
	});

	it('is disabled and does not fire onclick when clicked', async () => {
		const onclick = vi.fn();
		const screen = render(Button, { disabled: true, onclick, children: label('Save') });
		const button = screen.getByRole('button', { name: 'Save' });
		await expect.element(button).toBeDisabled();
		await button.click({ force: true }).catch(() => undefined);
		expect(onclick).not.toHaveBeenCalled();
	});
});
