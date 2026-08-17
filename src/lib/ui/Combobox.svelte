<script lang="ts">
	import type { Locale } from '$lib/schemas/post';
	import { t } from '$lib/i18n/t';

	interface Option {
		value: string;
		label: string;
		count?: number;
	}

	interface Props {
		id: string;
		label: string;
		options: Option[];
		selected: string[];
		placeholder?: string;
		locale?: Locale;
		onchange?: (next: string[]) => void;
	}

	let {
		id,
		label,
		options,
		selected = $bindable([]),
		placeholder = '',
		locale = 'en',
		onchange
	}: Props = $props();

	let open = $state(false);
	let query = $state('');
	// -1 is the sentinel for "no active option" — a fresh open (before any arrow press) or a
	// filter result with nothing highlighted yet. Every place that reads activeIndex either
	// checks for this sentinel explicitly or is guarded by activeId below.
	let activeIndex = $state(-1);
	let inputEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLUListElement | null>(null);
	let rootEl = $state<HTMLDivElement | null>(null);

	const listId = $derived(`${id}-listbox`);
	const labelId = $derived(`${id}-label`);

	// From `options`, not `visible`: typing narrows the list, and a chip must not vanish because the
	// user is searching for something else.
	const selectedOptions = $derived(options.filter((option) => selected.includes(option.value)));

	const visible = $derived(
		options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
	);

	// The clamp. Typing can narrow `visible` out from under an activeIndex that was set before
	// the filter ran (e.g. arrowed to the last option, then typed a character that drops it from
	// the list). Without this bounds check we would compute an id for an option that no longer
	// exists and hand it to assistive tech via aria-activedescendant — a dangling reference is an
	// accessibility violation in itself, worse than simply having no active option.
	const activeId = $derived(
		activeIndex >= 0 && activeIndex < visible.length
			? `${id}-option-${visible[activeIndex].value}`
			: undefined
	);

	function closeList(returnFocus: boolean) {
		open = false;
		activeIndex = -1;
		if (returnFocus) inputEl?.focus();
	}

	function toggle(value: string) {
		const next = selected.includes(value)
			? selected.filter((entry) => entry !== value)
			: [...selected, value];
		selected = next;
		onchange?.(next);
	}

	// A negative activeIndex is not a real position, so it cannot be fed into the usual
	// wraparound modulo — (-1 - 1 + length) % length lands one past where "before the first"
	// should land. Treat it as its own case: ArrowDown from nothing active goes to the first
	// option, ArrowUp goes to the last. Once activeIndex is a real index, normal wraparound
	// (index + delta + length) % length takes over in both directions.
	function moveActive(delta: 1 | -1) {
		open = true;
		if (visible.length === 0) {
			activeIndex = -1;
			return;
		}
		activeIndex =
			activeIndex < 0
				? delta === 1
					? 0
					: visible.length - 1
				: (activeIndex + delta + visible.length) % visible.length;
	}

	function onkeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				moveActive(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				moveActive(-1);
				break;
			case 'Home':
				if (!open) return;
				event.preventDefault();
				activeIndex = visible.length === 0 ? -1 : 0;
				break;
			case 'End':
				if (!open) return;
				event.preventDefault();
				activeIndex = visible.length === 0 ? -1 : visible.length - 1;
				break;
			case 'Enter':
				if (!open || activeIndex < 0 || activeIndex >= visible.length) return;
				event.preventDefault();
				toggle(visible[activeIndex].value);
				break;
			case 'Escape':
				// A dismissal the user expects to stay put after — send focus back to the input
				// they were just typing in.
				event.preventDefault();
				closeList(true);
				break;
			case 'Tab':
				// A deliberate move onward. Returning focus here would trap the user on a control
				// they just tried to leave.
				closeList(false);
				break;
		}
	}

	$effect(() => {
		if (!activeId || !listEl) return;
		listEl.querySelector(`#${CSS.escape(activeId)}`)?.scrollIntoView({ block: 'nearest' });
	});
</script>

<svelte:window
	onpointerdown={(event) => {
		// Closing here must never focus the input back — the user pointed at something else on
		// purpose, and stealing focus would fight whatever they were reaching for.
		if (open && rootEl && !rootEl.contains(event.target as Node)) closeList(false);
	}}
/>

<div bind:this={rootEl} class="relative flex flex-col gap-1.5">
	<label id={labelId} for={id} class="text-sm font-medium text-ink">{label}</label>
	<div class="relative">
		<input
			bind:this={inputEl}
			{id}
			type="text"
			role="combobox"
			autocomplete="off"
			{placeholder}
			aria-expanded={open}
			aria-controls={listId}
			aria-activedescendant={activeId}
			aria-haspopup="listbox"
			aria-autocomplete="list"
			bind:value={query}
			onclick={() => (open = true)}
			oninput={() => {
				open = true;
				// Filtering can quietly turn "the option at index 3" into a completely different
				// option, or drop it out of range entirely — either way, an index the user did not
				// choose is not what they expect aria-activedescendant/Enter to act on. Rather than
				// letting a stale-but-in-range index survive a filter, always re-anchor to the first
				// visible result (or nothing, if there are none), so what is highlighted always
				// matches what the query actually narrowed down to.
				activeIndex = visible.length > 0 ? 0 : -1;
			}}
			{onkeydown}
			class="h-9 w-full rounded-(--radius-control) border border-border-strong bg-surface px-3 pr-8 text-sm text-ink"
		/>
		<!-- Decorative only — aria-haspopup/aria-expanded on the input already carry the semantics.
		     Without this, a mouse user has no visual signal that the plain-looking text input is a
		     dropdown at all. -->
		<svg
			aria-hidden="true"
			viewBox="0 0 20 20"
			class="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-ink-muted transition-transform"
			class:rotate-180={open}
		>
			<path
				fill="currentColor"
				d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
			/>
		</svg>
	</div>

	<!--
		Always in the DOM, visually hidden — never conditionally rendered. A live region added at
		the same moment as its first announcement is frequently missed entirely; only its text
		changes, so assistive tech has already registered the region before there is anything to
		announce. Text is empty while closed so nothing is read on mount or on every keystroke
		before the list has ever been opened.
	-->
	<p class="sr-only" role="status" aria-live="polite">
		{open ? t(locale, 'combobox.resultCount', { count: visible.length }) : ''}
	</p>

	<!--
		Selected values live BELOW the control rather than inside it. The input doubles as the
		type-to-filter box, so chips placed in it would compete with the text the user is typing;
		outside, they cost nothing and each one can carry its own remove button.
	-->
	{#if selectedOptions.length > 0}
		<ul class="flex flex-wrap gap-1">
			{#each selectedOptions as option (option.value)}
				<li>
					<button
						type="button"
						onclick={() => toggle(option.value)}
						aria-label={t(locale, 'combobox.remove', { label: option.label })}
						class="inline-flex items-center gap-1 rounded-full bg-accent-surface px-2 py-0.5 text-xs font-medium text-accent-ink hover:bg-accent hover:text-accent-foreground"
					>
						{option.label}
						<span aria-hidden="true">×</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<div
		hidden={!open}
		class="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-(--radius-card) border border-border bg-surface shadow-(--shadow-card)"
	>
		<ul
			bind:this={listEl}
			id={listId}
			role="listbox"
			aria-multiselectable="true"
			aria-labelledby={labelId}
			class="max-h-64 overflow-auto"
		>
			{#each visible as option, index (option.value)}
				<li
					id={`${id}-option-${option.value}`}
					role="option"
					aria-selected={selected.includes(option.value)}
					class="flex cursor-pointer items-center justify-between px-3 py-2 text-sm"
					class:bg-accent-surface={index === activeIndex}
					class:text-accent-ink={index === activeIndex}
					onpointerdown={(event) => {
						// This <li> is not part of the input's focusable subtree, so the browser's
						// default mousedown action would blur the input the instant the pointer goes
						// down on it — breaking "focus never leaves the input" and taking
						// aria-activedescendant/typeahead down with it. click fires after that
						// blur has already happened, too late for a click-time preventDefault to
						// stop it. Handling pointerdown, and preventing its default focus/blur
						// behaviour before mouseup/click ever run, is what keeps focus on the input
						// through every selection.
						event.preventDefault();
						toggle(option.value);
					}}
					onpointerenter={() => (activeIndex = index)}
				>
					<!--
						The tick is the visible half of aria-selected. Without it, selection was announced to
						assistive tech and invisible to everyone else: a filtered table with no on-screen
						sign of what was filtering it.
					-->
					<span class="flex min-w-0 items-center gap-2">
						<!--
							width/height as attributes, not only classes. An SVG with neither falls back to
							300x150, and these components are rendered without a stylesheet in unit tests and
							for a moment before CSS lands in the browser — which turned every option into a
							396px block and dropped the list under the pointer.
						-->
						<svg
							aria-hidden="true"
							viewBox="0 0 20 20"
							width="14"
							height="14"
							class="shrink-0 {selected.includes(option.value) ? '' : 'invisible'}"
						>
							<path
								fill="currentColor"
								d="M8.1 13.2 5.3 10.4a.75.75 0 1 0-1.06 1.06l3.33 3.33a.75.75 0 0 0 1.06 0l7.13-7.13a.75.75 0 1 0-1.06-1.06L8.1 13.2Z"
							/>
						</svg>
						<span class="truncate">{option.label}</span>
					</span>
					{#if option.count !== undefined}
						<!-- Facet counts move whenever a status is edited, so the visual baseline masks
						     them by this hook rather than selecting on utility classes. -->
						<span
							data-testid="option-count"
							class="font-mono text-xs"
							class:text-ink-muted={index !== activeIndex}
							class:text-accent-ink={index === activeIndex}>{option.count}</span
						>
					{/if}
				</li>
			{/each}
		</ul>
		{#if visible.length === 0}
			<!-- A sibling of the listbox, not a child li — it must never be reachable via
			     role="option" queries or announced as a selectable item. -->
			<p class="px-3 py-2 text-sm text-ink-muted">{t(locale, 'combobox.noMatches')}</p>
		{/if}
	</div>
</div>
