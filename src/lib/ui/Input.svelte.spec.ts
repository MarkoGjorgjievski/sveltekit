import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Input from './Input.svelte';

describe('Input', () => {
	it('associates the label with the input via for/id', async () => {
		const screen = render(Input, { id: 'email', label: 'Email', name: 'email' });
		await expect.element(screen.getByLabelText('Email')).toBeInTheDocument();
	});

	it('marks the input invalid and points aria-describedby at the error message', async () => {
		const screen = render(Input, {
			id: 'email',
			label: 'Email',
			name: 'email',
			error: 'Email is required'
		});

		const input = screen.getByLabelText('Email');
		await expect.element(input).toHaveAttribute('aria-invalid', 'true');

		const describedBy = await input.element().getAttribute('aria-describedby');
		expect(describedBy).toBe('email-error');

		const errorElement = document.getElementById(describedBy ?? '');
		expect(errorElement).not.toBeNull();
		expect(errorElement?.textContent).toBe('Email is required');
	});
});
