import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ToastRegion from './ToastRegion.svelte';
import { TOAST_KEY, createToastQueue, type ToastQueue } from './toast.svelte';

function renderRegion(queue: ToastQueue) {
	return render(ToastRegion, { props: { locale: 'en' }, context: new Map([[TOAST_KEY, queue]]) });
}

describe('ToastRegion', () => {
	it('renders the live region with role=status and aria-live=polite even when empty', async () => {
		const screen = renderRegion(createToastQueue());

		const region = screen.getByRole('status');
		await expect.element(region).toBeInTheDocument();
		await expect.element(region).toHaveAttribute('aria-live', 'polite');
	});

	it('shows a pushed toast in the region, and dismissing it removes it', async () => {
		const queue = createToastQueue();
		const screen = renderRegion(queue);

		queue.push('Saved');
		await expect.element(screen.getByText('Saved')).toBeInTheDocument();

		await screen.getByRole('button', { name: 'Dismiss' }).click();
		await expect.element(screen.getByText('Saved')).not.toBeInTheDocument();
	});

	it('gives each toast an accessible dismiss control with a discernible name', async () => {
		const queue = createToastQueue();
		const screen = renderRegion(queue);

		queue.push('Could not save', 'danger');

		const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
		await expect.element(dismissButton).toBeInTheDocument();
	});

	it('keeps the second toast when the first of two is dismissed', async () => {
		const queue = createToastQueue();
		const screen = renderRegion(queue);

		queue.push('First message');
		queue.push('Second message');

		await expect.element(screen.getByText('First message')).toBeInTheDocument();
		await expect.element(screen.getByText('Second message')).toBeInTheDocument();

		await screen.getByRole('button', { name: 'Dismiss' }).first().click();

		await expect.element(screen.getByText('First message')).not.toBeInTheDocument();
		await expect.element(screen.getByText('Second message')).toBeInTheDocument();
	});
});
