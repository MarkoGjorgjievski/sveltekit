import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = ({ error, event, status }) => {
	// 404s are excluded. They are overwhelmingly crawlers and stale links rather than defects, and
	// reporting every one of them buries the errors that are.
	//
	// Imported dynamically for the same reason the vitals module is: hooks.client.ts is part of the
	// client entry, so a static import puts the reporter and its transport in the bundle every
	// visitor downloads in order to serve the few who hit an error — 0.9 kB of the landing budget's
	// remaining kilobyte. Fire-and-forget is safe here because returning is what renders the error
	// page, and that does not wait on the report.
	if (status !== 404) {
		void import('$lib/rum/report')
			.then(({ reportError }) => reportError(error, event.url.pathname))
			.catch(() => {
				// Reporting is best-effort. If the chunk cannot load, the user still gets the page.
			});
	}

	// Deliberately generic: this return value is rendered by +error.svelte, so echoing the real
	// error here would put stack traces and internal paths on the user's screen.
	return { message: 'Something went wrong.' };
};
