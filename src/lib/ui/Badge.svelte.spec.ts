import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Badge from './Badge.svelte';

const label = (text: string) => createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('Badge', () => {
	it('renders its children', async () => {
		const screen = render(Badge, { children: label('New') });
		await expect.element(screen.getByText('New')).toBeInTheDocument();
	});

	it('carries a distinguishable class per tone', async () => {
		const success = render(Badge, { tone: 'success', children: label('Done') });
		const danger = render(Badge, { tone: 'danger', children: label('Failed') });

		await expect.element(success.getByText('Done')).toBeInTheDocument();
		await expect.element(danger.getByText('Failed')).toBeInTheDocument();

		const successClass = success.getByText('Done').element().parentElement?.className;
		const dangerClass = danger.getByText('Failed').element().parentElement?.className;

		expect(successClass).toContain('success');
		expect(dangerClass).toContain('danger');
		expect(successClass).not.toBe(dangerClass);
	});
});
