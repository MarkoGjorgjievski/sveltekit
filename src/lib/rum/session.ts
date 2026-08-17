const STORAGE_KEY = 'rum_sid';

function randomId(): string {
	// crypto.randomUUID exists only in a secure context, which http://<lan-ip>:4173 is not.
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * The id shared by every beacon this tab sends.
 *
 * Shared between vitals and error reporting on purpose: an error is far more useful next to the
 * metrics of the session it happened in, and two independently generated ids would make that join
 * impossible after the fact.
 */
export function sessionId(): string {
	try {
		const existing = sessionStorage.getItem(STORAGE_KEY);
		if (existing) return existing;

		const created = randomId();
		sessionStorage.setItem(STORAGE_KEY, created);
		return created;
	} catch {
		// sessionStorage throws outright when storage is blocked rather than returning null. A
		// per-page id still yields valid data; it only costs correlation across navigations, which
		// is a better outcome than telemetry taking the page down with it.
		return randomId();
	}
}
