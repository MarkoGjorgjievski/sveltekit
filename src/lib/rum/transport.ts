import type { Beacon } from '$lib/schemas/beacon';

export const ENDPOINT = '/api/rum';

/**
 * Ships one beacon, preferring a transport that survives the page going away.
 *
 * Shared by the vitals queue and the error reporter so there is exactly one place that knows how
 * telemetry leaves the browser.
 */
export function send(beacon: Beacon): void {
	const body = JSON.stringify(beacon);

	// sendBeacon is the point — it outlives the document — but it returns false when the browser's
	// queue is full, and older Safari does not have it at all.
	if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
		const blob = new Blob([body], { type: 'application/json' });
		if (navigator.sendBeacon(ENDPOINT, blob)) return;
	}

	// keepalive is what lets this outlive the document too, so the fallback is a real fallback
	// rather than a request the browser cancels on unload.
	void fetch(ENDPOINT, {
		method: 'POST',
		body,
		keepalive: true,
		headers: { 'content-type': 'application/json' }
	}).catch(() => {
		// Telemetry must never surface to the user, and a failure here must never be reported
		// through the error beacon — a broken endpoint would report its own failures in a loop.
	});
}
