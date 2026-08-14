import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createToastQueue } from './toast.svelte';

describe('createToastQueue', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('auto-dismisses a success toast after 4000ms', () => {
		const queue = createToastQueue();
		queue.push('Saved');
		expect(queue.items).toHaveLength(1);

		vi.advanceTimersByTime(3999);
		expect(queue.items).toHaveLength(1);

		vi.advanceTimersByTime(1);
		expect(queue.items).toHaveLength(0);
	});

	it('auto-dismisses a danger toast after 8000ms, twice as long as success', () => {
		const queue = createToastQueue();
		queue.push('Could not save', 'danger');
		expect(queue.items).toHaveLength(1);

		vi.advanceTimersByTime(4000);
		expect(queue.items).toHaveLength(1);

		vi.advanceTimersByTime(3999);
		expect(queue.items).toHaveLength(1);

		vi.advanceTimersByTime(1);
		expect(queue.items).toHaveLength(0);
	});

	it('dismiss(id) removes a toast immediately', () => {
		const queue = createToastQueue();
		queue.push('Saved');
		const [toast] = queue.items;
		queue.dismiss(toast.id);
		expect(queue.items).toHaveLength(0);
	});

	// SSR-leak protection: createToastQueue must be a factory, never a module-level singleton,
	// because a shared queue would leak one user's toast into another user's server-rendered
	// response. If this ever regresses to a singleton, the two queues below would share state
	// and this test would fail.
	it('gives two independently created queues independent state', () => {
		const first = createToastQueue();
		const second = createToastQueue();

		first.push('Only in the first queue');

		expect(first.items).toHaveLength(1);
		expect(second.items).toHaveLength(0);
	});
});
