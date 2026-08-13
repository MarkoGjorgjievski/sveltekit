import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Select from './Select.svelte';

describe('Select', () => {
	it('associates the label with the select via for/id', async () => {
		const screen = render(Select, {
			id: 'country',
			label: 'Country',
			name: 'country',
			options: [
				{ value: 'us', label: 'United States' },
				{ value: 'de', label: 'Germany' }
			]
		});
		await expect.element(screen.getByLabelText('Country')).toBeInTheDocument();
	});

	it('marks the select invalid and points aria-describedby at the error message', async () => {
		const screen = render(Select, {
			id: 'country',
			label: 'Country',
			name: 'country',
			error: 'Country is required',
			options: [{ value: 'us', label: 'United States' }]
		});

		const select = screen.getByLabelText('Country');
		await expect.element(select).toHaveAttribute('aria-invalid', 'true');
		await expect.element(select).toHaveAttribute('aria-describedby', 'country-error');
	});
});
