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

	// The Escape branch of onkeydown lives on the input's own keydown handler, so it can only ever
	// fire while the input already has focus — there is no code path in this component that lets
	// Escape reach that handler from a blurred state. closeList(true) still passes `returnFocus`
	// (cheap, and it documents intent for anyone extending this later), but "returns focus" is not
	// something a test can actually demonstrate here; the real, testable invariant is that closing
	// via Escape never blurs the input as a side effect.
	it('closes on Escape and leaves focus on the input', async () => {
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

	// Five options collapse to a different, smaller set on every keystroke. An activeIndex that
	// survives the filter unchanged can silently point at whichever option now happens to sit at
	// that position — not the one the user actually arrowed to. The fix is to re-anchor to the
	// first visible result on every filter change, so aria-activedescendant (and Enter) can never
	// act on an option the user never highlighted.
	it('resets the active option to the first result when a filter changes it out from under the user', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('{ArrowUp}');
		await expect.element(input).toHaveAttribute('aria-activedescendant', 'status-option-draft');

		// "d" matches Archived and Draft, in that order — Draft (previously active) is now second.
		await userEvent.keyboard('d');
		await expect.element(input).toHaveAttribute('aria-activedescendant', 'status-option-archived');

		await userEvent.keyboard('{Enter}');
		await expect
			.element(screen.getByRole('option', { name: /Archived/ }))
			.toHaveAttribute('aria-selected', 'true');
		await expect
			.element(screen.getByRole('option', { name: /Draft/ }))
			.toHaveAttribute('aria-selected', 'false');
	});

	// The reset above covers filtering via typing. `options` shrinking from the parent without any
	// keystroke (a prop update, not user input) takes a different code path — oninput never fires —
	// so the bounds guard on activeId is what has to catch it instead.
	it('keeps aria-activedescendant valid when the options prop shrinks without a keypress', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('{ArrowUp}');
		await expect.element(input).toHaveAttribute('aria-activedescendant', 'status-option-draft');

		await screen.rerender({ options: [options[0]] });

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

	it('keeps focus on the input when pointing at an option to select it', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('{ArrowDown}');
		await userEvent.click(screen.getByRole('option', { name: /Active/ }));
		await expect
			.element(screen.getByRole('option', { name: /Active/ }))
			.toHaveAttribute('aria-selected', 'true');
		await expect.element(input).toHaveFocus();
	});

	it('renders the empty state without exposing it as an option', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await userEvent.keyboard('zzz');
		await expect.element(screen.getByText('No matches')).toBeInTheDocument();
		expect(screen.container.querySelectorAll('[role="option"]').length).toBe(0);
	});

	it('labels the listbox via aria-labelledby pointing at the input label, and marks it multiselectable', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();

		const listboxId = await input.element().getAttribute('aria-controls');
		expect(listboxId).not.toBeNull();
		const listboxEl = listboxId ? document.getElementById(listboxId) : null;
		expect(listboxEl).not.toBeNull();
		expect(listboxEl?.getAttribute('aria-multiselectable')).toBe('true');

		const labelledBy = listboxEl?.getAttribute('aria-labelledby');
		expect(labelledBy).not.toBeNull();
		const labelEl = labelledBy ? document.getElementById(labelledBy) : null;
		expect(labelEl?.tagName).toBe('LABEL');
		expect(labelEl?.textContent).toBe('Status');
	});

	it('exposes aria-expanded as the literal strings "false" and "true"', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		expect(await input.element().getAttribute('aria-expanded')).toBe('false');
		await input.click();
		await userEvent.keyboard('{ArrowDown}');
		expect(await input.element().getAttribute('aria-expanded')).toBe('true');
	});

	// Finding 3: the listbox is now always in the DOM (hidden, not conditionally rendered), so
	// aria-controls always points at a real element — including in the default, never-opened state
	// an axe pass over a page full of closed comboboxes would otherwise flag.
	it('keeps aria-controls pointing at a real element even when never opened', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		const controls = await input.element().getAttribute('aria-controls');
		expect(controls).not.toBeNull();
		expect(controls ? document.getElementById(controls) : null).not.toBeNull();
	});

	it('does not expose its options via role queries while closed', async () => {
		const screen = setup();
		expect(screen.getByRole('option').elements().length).toBe(0);
	});

	it('opens on a plain click on the input, not only on ArrowDown or typing', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await input.click();
		await expect.element(input).toHaveAttribute('aria-expanded', 'true');
	});

	it('exposes aria-autocomplete="list" — typed text filters rather than inserts', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		await expect.element(input).toHaveAttribute('aria-autocomplete', 'list');
	});

	// Finding 1: filtering to zero results must not be silent. The region is always in the DOM
	// (never conditionally rendered) so assistive tech has already registered it before there is
	// anything to announce; only its text changes.
	it('announces the result count through a persistent live region', async () => {
		const screen = setup();
		const input = screen.getByRole('combobox', { name: 'Status' });
		const status = screen.container.querySelector('[role="status"]');
		expect(status).not.toBeNull();
		expect(status?.textContent).toBe('');

		await input.click();
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(screen.getByText('3 options available')).toBeInTheDocument();

		await userEvent.keyboard('zzz');
		await expect.element(screen.getByText('0 options available')).toBeInTheDocument();
	});
});
