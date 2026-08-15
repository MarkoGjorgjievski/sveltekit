import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { stringify } from 'devalue';
import { TOAST_KEY, createToastQueue, type ToastQueue } from '$lib/ui/toast.svelte';
import { createOptimisticStatus } from './optimistic.svelte';
import StatusCell from './StatusCell.svelte';
import type { Item } from '$lib/schemas/item';

// $app/navigation's `invalidate` is mocked so the success/failure paths don't attempt a real
// SvelteKit dependency-tracking call with no router mounted — matching page.svelte.spec.ts's own
// mock for the same reason.
// invalidateAll is stubbed too, not because StatusCell calls it (it deliberately never does — see
// optimistic.svelte.ts and the success handler below), but because $app/forms's `enhance` imports
// it internally, and a partial module mock without it throws a missing-export error the moment
// `use:enhance` is evaluated — see page.svelte.spec.ts's identical mock for the same reason.
const invalidateMock = vi.fn<(key: string) => Promise<void>>();
vi.mock('$app/navigation', () => ({
	invalidate: (key: string) => invalidateMock(key),
	invalidateAll: vi.fn()
}));

// `enhance`'s own `deserialize()` and its default fallback callback both reach into SvelteKit's
// live client runtime (`app.decoders`, `applyAction`'s `root`/`page` globals) that only exist
// after the generated app.js bootstraps a full page — which never happens when a single component
// is mounted in isolation via `render()`. Without this, *every* real HTTP response (success or
// failure alike) blows up inside `deserialize` before this component's own code ever sees it,
// and every result silently becomes `{ type: 'error' }` regardless of what the mocked response
// actually said — verified by running this suite without the mock: 403/409 responses reported the
// network-failure message instead of their own. `applyAction` is stubbed to a no-op for the same
// reason; StatusCell doesn't rely on it (it drives its own optimistic UI directly off `result`),
// so replacing it changes nothing about what's under test.
vi.mock('../../../../../node_modules/@sveltejs/kit/src/runtime/client/client.js', () => ({
	app: { decoders: {} },
	applyAction: vi.fn()
}));

function makeItem(overrides: Partial<Item> = {}): Item {
	return {
		id: 'item_1',
		name: 'Spring campaign',
		status: 'draft',
		channel: 'email',
		owner: { id: 'owner_1', name: 'Owner One' },
		budget: 1000,
		spent: 250,
		impressions: 10000,
		clicks: 100,
		ctr: 0.01,
		startDate: '2026-01-01',
		endDate: '2026-02-01',
		updatedAt: '2026-01-15T00:00:00.000Z',
		tags: [],
		...overrides
	};
}

// A deferred promise the test resolves manually, so response *arrival order* is controlled
// directly by the test rather than by hoping real timers or microtask ordering cooperate.
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
	let resolveFn: ((value: T) => void) | undefined;
	const promise = new Promise<T>((resolve) => {
		resolveFn = resolve;
	});
	return {
		promise,
		resolve: (value: T) => resolveFn?.(value)
	};
}

// Mirrors the exact wire format @sveltejs/kit's server builds for a JSON action response
// (type/status/devalue-encoded data) — see node_modules/@sveltejs/kit's
// runtime/server/page/actions.js `stringify_action_response`, which this project has no custom
// `transport` hooks to complicate.
function successResponse(item: Item): Response {
	const body = JSON.stringify({ type: 'success', status: 200, data: stringify({ item }) });
	return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
}

function failureResponse(status: number, reason: string): Response {
	const body = JSON.stringify({ type: 'failure', status, data: stringify({ reason }) });
	return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

// `use:enhance` (from $app/forms) calls the ambient global `fetch`, not an injected event.fetch —
// this replaces it for the duration of each test so responses can be handed out, and resolved, on
// the test's own schedule.
let originalFetch: typeof fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	originalFetch = window.fetch;
	fetchMock = vi.fn();
	window.fetch = fetchMock as unknown as typeof fetch;
	invalidateMock.mockClear();
});

afterEach(() => {
	window.fetch = originalFetch;
});

function renderCell(
	item: Item,
	options: { canEdit?: boolean; optimistic?: ReturnType<typeof createOptimisticStatus> } = {}
) {
	const optimistic = options.optimistic ?? createOptimisticStatus();
	const toasts = createToastQueue();
	const screen = render(StatusCell, {
		props: { item, locale: 'en', canEdit: options.canEdit ?? true, optimistic },
		context: new Map<symbol, ToastQueue>([[TOAST_KEY, toasts]])
	});
	const select = screen.getByTestId(`status-${item.id}`);
	return { screen, select, optimistic, toasts };
}

describe('StatusCell — accessible naming', () => {
	it("gives the select an accessible name built from that item's own name", async () => {
		renderCell(makeItem({ id: 'item_1', name: 'Spring campaign' }));

		await expect.element(document.body).toHaveTextContent('Change status for Spring campaign');

		const label = document.querySelector('label[for="status-item_1"]');
		expect(label?.textContent?.trim()).toBe('Change status for Spring campaign');
	});

	it('gives two different rows two different accessible names, each naming its own item', async () => {
		const optimistic = createOptimisticStatus();
		renderCell(makeItem({ id: 'item_1', name: 'Spring campaign' }), { optimistic });
		renderCell(makeItem({ id: 'item_2', name: 'Autumn campaign' }), { optimistic });

		const labelOne = document.querySelector('label[for="status-item_1"]');
		const labelTwo = document.querySelector('label[for="status-item_2"]');

		expect(labelOne?.textContent?.trim()).toBe('Change status for Spring campaign');
		expect(labelTwo?.textContent?.trim()).toBe('Change status for Autumn campaign');
		expect(labelOne?.textContent).not.toBe(labelTwo?.textContent);
	});
});

describe('StatusCell — optimistic apply', () => {
	it('shows the newly picked status immediately, before the response resolves', async () => {
		const pending = deferred<Response>();
		fetchMock.mockReturnValue(pending.promise);

		const item = makeItem({ status: 'draft' });
		const { select, optimistic } = renderCell(item);

		await select.selectOptions('active');

		// The fetch was issued (request in flight) but its response has deliberately not resolved
		// yet — the display has already moved to "active" regardless. Asserted on the optimistic
		// store directly, not only on the select's DOM value: a real `selectOptions` interaction
		// sets that DOM value on its own, browser-side, regardless of whether this component's own
		// reactive `value={shown}` binding ever runs — so a version that forgot to call
		// `optimistic.begin` before the request is sent (applying the value only once the response
		// eventually resolves) could still show "active" here by DOM-interaction accident alone.
		// The store has no such accident: nothing sets it except this component's own submit logic.
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(optimistic.overrides.get(item.id)?.value).toBe('active');
		await expect.element(select).toHaveValue('active');
	});

	it('disables the select for a viewer, so the authorization boundary is visible, not just enforced server-side', async () => {
		const { select } = renderCell(makeItem(), { canEdit: false });
		await expect.element(select).toBeDisabled();
	});
});

describe('StatusCell — four rollback classes plus network', () => {
	it('rolls back to the server value and shows the role-specific message on a 403 failure', async () => {
		const pending = deferred<Response>();
		fetchMock.mockReturnValue(pending.promise);

		const { select, toasts } = renderCell(makeItem({ status: 'draft' }));

		await select.selectOptions('active');
		await expect.element(select).toHaveValue('active');

		pending.resolve(failureResponse(403, 'role'));
		await expect.element(select).toHaveValue('draft');
		await expect
			.poll(() => toasts.items.map((toast) => toast.message))
			.toContain('Your role cannot edit campaigns.');
	});

	it('rolls back and shows the archived-specific message on a 409 failure — different copy than 403', async () => {
		const pending = deferred<Response>();
		fetchMock.mockReturnValue(pending.promise);

		const { select, toasts } = renderCell(makeItem({ status: 'draft' }));

		await select.selectOptions('active');
		await expect.element(select).toHaveValue('active');

		pending.resolve(failureResponse(409, 'archived'));
		await expect.element(select).toHaveValue('draft');
		await expect
			.poll(() => toasts.items.map((toast) => toast.message))
			.toContain('Archived campaigns cannot be changed.');
	});

	it('rolls back and shows the invalid-status message on a 400 failure — a row-deletion boundary must not be confused with a permissions one', async () => {
		const pending = deferred<Response>();
		fetchMock.mockReturnValue(pending.promise);

		const { select, toasts } = renderCell(makeItem({ status: 'draft' }));

		await select.selectOptions('active');
		await expect.element(select).toHaveValue('active');

		pending.resolve(failureResponse(400, 'invalid'));
		await expect.element(select).toHaveValue('draft');
		await expect
			.poll(() => toasts.items.map((toast) => toast.message))
			.toContain('That status is not valid.');
	});

	it('rolls back and shows the row-missing message on a 404 failure — not the role message', async () => {
		const pending = deferred<Response>();
		fetchMock.mockReturnValue(pending.promise);

		const { select, toasts } = renderCell(makeItem({ status: 'draft' }));

		await select.selectOptions('active');
		await expect.element(select).toHaveValue('active');

		pending.resolve(failureResponse(404, 'missing'));
		await expect.element(select).toHaveValue('draft');
		await expect
			.poll(() => toasts.items.map((toast) => toast.message))
			.toContain('That campaign no longer exists.');
	});

	it('rolls back and shows the network-specific message when the request itself throws — different copy than any server-returned reason', async () => {
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

		const { select, toasts } = renderCell(makeItem({ status: 'draft' }));

		await select.selectOptions('active');

		await expect.element(select).toHaveValue('draft');
		await expect
			.poll(() => toasts.items.map((toast) => toast.message))
			.toContain('Could not save. Check your connection.');
	});

	// Extends (rather than duplicates) the message-distinctness assertion to all four reasons the
	// action's `fail(...)` calls can actually send. `failureMessageKey` collapsing any pair of
	// these into one message is exactly the bug: a row another session deleted (`missing`) or a
	// status that fails validation (`invalid`) are not permissions problems, and showing "your role
	// cannot edit campaigns" for either is actively wrong about which boundary the user hit.
	it('shows four different messages for the four failure reasons, not one generic message', async () => {
		const messages = new Set<string>();

		const cases: Array<[status: number, reason: string]> = [
			[403, 'role'],
			[409, 'archived'],
			[400, 'invalid'],
			[404, 'missing']
		];

		for (const [status, reason] of cases) {
			fetchMock.mockReturnValueOnce(Promise.resolve(failureResponse(status, reason)));
			const cell = renderCell(makeItem({ id: `${reason}_row`, status: 'draft' }));
			await cell.select.selectOptions('active');
			await expect.poll(() => cell.toasts.items.length).toBeGreaterThan(0);
			cell.toasts.items.forEach((toast) => messages.add(toast.message));
		}

		expect(messages.size).toBe(4);
	});
});

describe('StatusCell — success path', () => {
	it('commits the optimistic value, shows a saved toast, and invalidates app:items only', async () => {
		const item = makeItem({ status: 'draft' });
		fetchMock.mockReturnValue(Promise.resolve(successResponse({ ...item, status: 'active' })));

		const { select, toasts, optimistic } = renderCell(item);

		await select.selectOptions('active');

		await expect.poll(() => toasts.items.map((toast) => toast.message)).toContain('Saved.');
		await expect.poll(() => optimistic.overrides.has(item.id)).toBe(false);
		expect(invalidateMock).toHaveBeenCalledWith('app:items');
		expect(invalidateMock).not.toHaveBeenCalledWith(undefined);
		expect(invalidateMock).toHaveBeenCalledTimes(1);
	});

	it('also invalidates app:items on a failure, so a row that drifted from server truth gets re-read', async () => {
		const pending = deferred<Response>();
		fetchMock.mockReturnValue(pending.promise);

		const { select } = renderCell(makeItem({ status: 'draft' }));

		await select.selectOptions('active');
		pending.resolve(failureResponse(409, 'archived'));

		await expect.poll(() => invalidateMock.mock.calls.length).toBeGreaterThan(0);
		expect(invalidateMock).toHaveBeenCalledWith('app:items');
	});
});

// Renders one row and drives it through two edits (draft -> paused -> archived) before either
// request's response has resolved, returning both requests' deferred responses so the calling
// test controls the order they settle in.
async function renderTwoInFlightEdits(item: Item = makeItem({ status: 'draft' })) {
	const firstResponse = deferred<Response>();
	const secondResponse = deferred<Response>();
	fetchMock.mockReturnValueOnce(firstResponse.promise);
	fetchMock.mockReturnValueOnce(secondResponse.promise);

	const cell = renderCell(item);

	// First edit: draft -> paused. Request #1 sent, left pending.
	await cell.select.selectOptions('paused');
	await expect.element(cell.select).toHaveValue('paused');

	// Second edit, before the first has resolved: paused -> archived. Request #2 sent.
	await cell.select.selectOptions('archived');
	await expect.element(cell.select).toHaveValue('archived');

	expect(fetchMock).toHaveBeenCalledTimes(2);

	return { ...cell, firstResponse, secondResponse };
}

describe('StatusCell — pending-token race', () => {
	// The bug the per-row token guards against: two edits on the same row, where the *older*
	// request's response arrives *after* the newer one's. Without the guard, the stale response's
	// commit/rollback would clobber the row after the newer response already settled it —
	// last-write-wins by response order, not request order. Both responses are deferred promises
	// resolved by hand in a deliberately inverted order, exercising the guard through the real
	// fetch/enhance stack rather than by calling the store's methods directly
	// (optimistic.svelte.spec.ts already does that in isolation).
	//
	// Both tests below synchronize on `invalidateMock`'s call count rather than asserting the
	// select's value straight after calling `.resolve()`: the response's own async handling (its
	// `fetch` -> `response.text()` -> `deserialize()` -> callback chain) hasn't necessarily run yet
	// at that point, so a bare `toHaveValue` poll can pass "for free" by observing a value that was
	// already correct *before* the guard even had a chance to run — proving nothing.
	// `invalidate('app:items')` is called unconditionally at the end of every response's handling
	// (owned or superseded, success or failure — see StatusCell.svelte), so waiting for its call
	// count is a real completion signal even for a superseded response, which no longer pushes a
	// toast at all (see the "superseded response" describe block below).
	it('a stale first failure resolving after a faster second failure does not resurrect an abandoned guess', async () => {
		const { select, toasts, optimistic, firstResponse, secondResponse } =
			await renderTwoInFlightEdits();

		// The second (newer) request's response arrives first and fails. It owns the row, so it
		// rolls back — which, correctly, means the override is simply cleared: the display falls
		// back to `item.status` ("draft", the server's own truth), not to "paused" (the first
		// edit's still-unconfirmed guess, and exactly the value an earlier, buggy version of
		// `rollback` would have restored here).
		secondResponse.resolve(failureResponse(409, 'archived'));
		await expect.poll(() => invalidateMock.mock.calls.length).toBe(1);
		await expect.element(select).toHaveValue('draft');
		expect(toasts.items).toHaveLength(1);

		// The first (older) request's response finally arrives, also a failure. Its ticket no
		// longer owns the row — the guard makes this a no-op on the override (there is nothing left
		// to touch; it's already cleared) and, per the superseded-response rule, it must not push a
		// second toast either.
		firstResponse.resolve(failureResponse(403, 'role'));
		await expect.poll(() => invalidateMock.mock.calls.length).toBe(2);
		await expect.element(select).toHaveValue('draft');
		expect(optimistic.overrides.has('item_1')).toBe(false);
		expect(toasts.items).toHaveLength(1);
	});

	// Same interleaving, but the *first* (stale) request eventually succeeds rather than fails —
	// exercising `commit`'s guard specifically. Without it, a stale success would either delete an
	// override it doesn't own, or (in the version this fix replaced) resurrect a value nobody
	// wanted. Either way the row must stay exactly where the second (owning) response already left
	// it, and the stale success must resolve silently.
	it('a stale first success arriving after a faster second failure does not disturb the row or toast again', async () => {
		const item = makeItem({ status: 'draft' });
		const { select, toasts, optimistic, firstResponse, secondResponse } =
			await renderTwoInFlightEdits(item);

		secondResponse.resolve(failureResponse(409, 'archived'));
		await expect.poll(() => invalidateMock.mock.calls.length).toBe(1);
		await expect.element(select).toHaveValue('draft');
		expect(toasts.items).toHaveLength(1);

		firstResponse.resolve(successResponse({ ...item, status: 'paused' }));
		await expect.poll(() => invalidateMock.mock.calls.length).toBe(2);
		await expect.element(select).toHaveValue('draft');
		expect(optimistic.overrides.has(item.id)).toBe(false);
		expect(toasts.items).toHaveLength(1);
	});
});

describe('StatusCell — superseded response', () => {
	// Editing twice quickly and having the first (now-abandoned) request's failure pop up as an
	// error toast is misleading: the user already replaced that value with a second edit, so a
	// toast about the first one reads as an error about something they didn't do and aren't
	// looking at anymore. A superseded ticket's commit/rollback still runs (and still invalidates),
	// it just doesn't report to the user — the live ticket's own eventual response is what does.
	it('shows exactly one toast when the first of two edits fails after the second has already begun', async () => {
		const { toasts, firstResponse, secondResponse } = await renderTwoInFlightEdits();

		// The first request's failure arrives after the second edit has already begun — it is
		// superseded the instant the second edit called `begin`, before this response even lands.
		firstResponse.resolve(failureResponse(403, 'role'));
		await expect.poll(() => invalidateMock.mock.calls.length).toBe(1);
		expect(toasts.items).toHaveLength(0);

		// The second (live) request's own response still reports normally.
		secondResponse.resolve(failureResponse(409, 'archived'));
		await expect.poll(() => invalidateMock.mock.calls.length).toBe(2);
		expect(toasts.items).toHaveLength(1);
		expect(toasts.items[0]?.message).toBe('Archived campaigns cannot be changed.');
	});
});
