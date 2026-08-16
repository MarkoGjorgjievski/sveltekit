import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';
import type { Beacon } from '$lib/schemas/beacon';
import { shouldSample } from './sampling';

const STORAGE_KEY = 'rum_sid';
const ENDPOINT = '/api/rum';

function randomId(): string {
	// crypto.randomUUID exists only in a secure context, which http://<lan-ip>:4173 is not.
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function sessionId(): string {
	try {
		const existing = sessionStorage.getItem(STORAGE_KEY);
		if (existing) return existing;

		const created = randomId();
		sessionStorage.setItem(STORAGE_KEY, created);
		return created;
	} catch {
		// sessionStorage throws outright when storage is blocked rather than returning null. A
		// per-page id still yields valid metrics; it only costs correlation across navigations,
		// which is a better outcome than the beacon taking the page down with it.
		return randomId();
	}
}

const queue: Beacon[] = [];

function send(beacon: Beacon): boolean {
	const body = JSON.stringify(beacon);

	// sendBeacon survives the page going away, which is the entire point — but it returns false
	// when the browser's queue is full, and it is absent in older Safari.
	if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
		const blob = new Blob([body], { type: 'application/json' });
		if (navigator.sendBeacon(ENDPOINT, blob)) return true;
	}

	// keepalive is what lets this outlive the document too, so the fallback is a real fallback
	// rather than a request the browser cancels on unload.
	void fetch(ENDPOINT, {
		method: 'POST',
		body,
		keepalive: true,
		headers: { 'content-type': 'application/json' }
	}).catch(() => {
		// Telemetry must never surface to the user, and never reach the error beacon either —
		// a failing endpoint would otherwise report its own failures in a loop.
	});
	return true;
}

function flush() {
	// splice first: anything queued while flushing belongs to the next flush, not this one.
	for (const beacon of queue.splice(0, queue.length)) send(beacon);
}

export function reportWebVitals(sampleRate = 0.1) {
	const id = sessionId();
	if (!shouldSample(id, sampleRate, location.search)) return;

	const record = (metric: Metric) => {
		queue.push({
			kind: 'vital',
			name: metric.name,
			// CLS is unitless and tiny; milliseconds do not need sub-micron precision. Rounding
			// here keeps the payload small and the log readable.
			value: Math.round(metric.value * 1000) / 1000,
			rating: metric.rating,
			path: location.pathname,
			sessionId: id
		});
	};

	onLCP(record);
	onINP(record);
	onCLS(record);
	onTTFB(record);
	onFCP(record);

	// visibilitychange and pagehide rather than unload: unload frequently never fires on mobile
	// Safari, and registering it disqualifies the page from the back/forward cache everywhere.
	//
	// visibilitychange is bound on `document`, which is where it is dispatched. It does bubble to
	// window, so a window listener happens to work, but binding to the target the spec names
	// leaves no room for that detail to matter. pagehide is a window event.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') flush();
	});
	window.addEventListener('pagehide', flush);
}
