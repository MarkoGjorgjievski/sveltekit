import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from '@vitest/browser/context';
import Combobox from './Combobox.svelte';

const options = [
	{ value: 'active', label: 'Active', count: 72 },
	{ value: 'archived', label: 'Archived', count: 32 },
	{ value: 'draft', label: 'Draft', count: 23 }
];

function setup() {
	return render(Combobox, { id: 'status', label: 'Status', options, selected: [] });
}

describe('Combobox', () => {
	it('exposes combobox semantics when closed', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await expect.element(input).toHaveAttribute('aria-expanded', 'false');
	});

	it('opens on ArrowDown and marks the first option active', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(input).toHaveAttribute('aria-expanded', 'true');
		await expect.element(input).toHaveAttribute('aria-activedescendant', 'status-option-active');
	});

	it('selects the active option with Enter and reflects aria-selected', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('{ArrowDown}{Enter}');
		await expect
			.element(screen.getByRole('option', { name: /Active/ }))
			.toHaveAttribute('aria-selected', 'true');
	});

	it('filters options by typeahead', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('arch');
		await expect.element(screen.getByRole('option', { name: /Archived/ })).toBeInTheDocument();
		expect(screen.container.querySelectorAll('[role="option"]').length).toBe(1);
	});

	it('closes on Escape and returns focus to the input', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('{ArrowDown}{Escape}');
		await expect.element(input).toHaveAttribute('aria-expanded', 'false');
		await expect.element(input).toHaveFocus();
	});

	it('wraps from the last option to the first', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('{ArrowUp}');
		await expect.element(input).toHaveAttribute('aria-activedescendant', 'status-option-draft');
	});

	it('wraps from the last option back to the first on ArrowDown', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
		await expect.element(input).toHaveAttribute('aria-activedescendant', 'status-option-active');
	});

	it('Tab closes the list without returning focus to the input', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		const outside = document.createElement('button');
		outside.type = 'button';
		outside.textContent = 'elsewhere';
		document.body.appendChild(outside);

		await input.click();
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(input).toHaveAttribute('aria-expanded', 'true');

		await userEvent.tab();
		await expect.element(input).toHaveAttribute('aria-expanded', 'false');
		expect(document.activeElement).not.toBe(input.element());

		outside.remove();
	});

	it('jumps to the first and last option with Home and End while open', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('{ArrowDown}{ArrowDown}');
		await expect.element(input).toHaveAttribute('aria-activedescendant', 'status-option-archived');

		await userEvent.keyboard('{End}');
		await expect.element(input).toHaveAttribute('aria-activedescendant', 'status-option-draft');

		await userEvent.keyboard('{Home}');
		await expect.element(input).toHaveAttribute('aria-activedescendant', 'status-option-active');
	});

	it('never leaves aria-activedescendant pointing at an option removed by filtering', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('{ArrowUp}');
		await expect.element(input).toHaveAttribute('aria-activedescendant', 'status-option-draft');

		await userEvent.keyboard('arch');
		const activeDescendant = await input.element().getAttribute('aria-activedescendant');
		if (activeDescendant === null) {
			expect(activeDescendant).toBeNull();
		} else {
			expect(document.getElementById(activeDescendant)).not.toBeNull();
		}
	});

	it('closes on an outside pointerdown without stealing focus back to the input', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		const outside = document.createElement('button');
		outside.type = 'button';
		outside.textContent = 'elsewhere';
		document.body.appendChild(outside);

		await input.click();
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(input).toHaveAttribute('aria-expanded', 'true');

		await userEvent.click(outside);
		await expect.element(input).toHaveAttribute('aria-expanded', 'false');
		expect(document.activeElement).toBe(outside);

		outside.remove();
	});

	it('does not close on selection, and toggles the same option back off', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('{ArrowDown}{Enter}');
		await expect.element(input).toHaveAttribute('aria-expanded', 'true');
		await expect
			.element(screen.getByRole('option', { name: /Active/ }))
			.toHaveAttribute('aria-selected', 'true');

		await userEvent.keyboard('{Enter}');
		await expect
			.element(screen.getByRole('option', { name: /Active/ }))
			.toHaveAttribute('aria-selected', 'false');
	});

	it('renders the empty state without exposing it as an option', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('zzz');
		await expect.element(screen.getByText('No matches')).toBeInTheDocument();
		expect(screen.container.querySelectorAll('[role="option"]').length).toBe(0);
	});

	it('marks the listbox as multiselectable and labelled', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('{ArrowDown}');
		const listbox = screen.getByRole('listbox', { name: 'Status' });
		await expect.element(listbox).toHaveAttribute('aria-multiselectable', 'true');
	});

	it('exposes aria-expanded as the literal strings "false" and "true"', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		expect(await input.element().getAttribute('aria-expanded')).toBe('false');
		await input.click();
		await userEvent.keyboard('{ArrowDown}');
		expect(await input.element().getAttribute('aria-expanded')).toBe('true');
	});
});
