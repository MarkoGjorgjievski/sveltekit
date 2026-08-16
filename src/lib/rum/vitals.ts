import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';
import type { Beacon } from '$lib/schemas/beacon';
import { shouldSample } from './sampling';
import { sessionId } from './session';
import { send } from './transport';

const queue: Beacon[] = [];

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
