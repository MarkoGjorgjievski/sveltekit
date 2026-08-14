import { SvelteMap } from 'svelte/reactivity';

export interface Toast {
	id: number;
	message: string;
	tone: 'success' | 'danger';
}

export const TOAST_KEY = Symbol('toast');

export function createToastQueue() {
	const entries = new SvelteMap<number, Toast>();
	let nextId = 0;

	return {
		get items(): Toast[] {
			return [...entries.values()];
		},
		push(message: string, tone: Toast['tone'] = 'success') {
			const id = ++nextId;
			entries.set(id, { id, message, tone });
			setTimeout(() => entries.delete(id), tone === 'danger' ? 8000 : 4000);
		},
		dismiss(id: number) {
			entries.delete(id);
		}
	};
}

export type ToastQueue = ReturnType<typeof createToastQueue>;
