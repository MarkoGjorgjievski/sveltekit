// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			locale: 'en' | 'de';
			theme: 'light' | 'dark';
			user: { id: string; email: string; name: string; role: 'admin' | 'editor' | 'viewer' } | null;
		}
	}
}

export {};
