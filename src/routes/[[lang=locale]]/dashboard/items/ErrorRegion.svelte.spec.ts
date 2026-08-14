import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ErrorRegion from './ErrorRegion.svelte';

describe('ErrorRegion', () => {
	it('announces itself immediately via role="alert"', async () => {
		const screen = render(ErrorRegion, { locale: 'en', onretry: () => {} });

		const alert = screen.container.querySelector('[role="alert"]');
		expect(alert).not.toBeNull();
	});

	it('calls onretry when the retry button is clicked', async () => {
		const onretry = vi.fn();
		const screen = render(ErrorRegion, { locale: 'en', onretry });

		const button = screen.getByRole('button');
		await button.click();

		expect(onretry).toHaveBeenCalledOnce();
	});

	it('renders the locale-appropriate copy', async () => {
		const screen = render(ErrorRegion, { locale: 'de', onretry: () => {} });

		await expect.element(screen.getByText('Etwas ist schiefgelaufen.')).toBeInTheDocument();
	});
});
