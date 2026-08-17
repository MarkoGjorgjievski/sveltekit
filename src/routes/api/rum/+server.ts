import { BeaconSchema } from '$lib/schemas/beacon';
import type { RequestHandler } from './$types';

// The highest-volume, lowest-work endpoint in the app: no Node APIs, no data access, nothing to
// cache. Edge keeps it off a Node lambda's cold start and close to the user, so telemetry never
// adds latency to the session it is measuring.
export const config = { runtime: 'edge' };

export const POST: RequestHandler = async ({ request }) => {
	const parsed = BeaconSchema.safeParse(await request.json().catch(() => null));

	// Deliberately no error body. This endpoint is called by sendBeacon, which discards the
	// response, so a message would only ever be read by someone probing the schema.
	if (!parsed.success) return new Response(null, { status: 400 });

	// Swap for a real sink (Sentry, Axiom, a warehouse) — the wiring is the point here, not the
	// destination. Logging happens AFTER validation: writing unvalidated client input into a log
	// stream is how forged newlines become forged log entries.
	console.log(JSON.stringify({ at: new Date().toISOString(), ...parsed.data }));

	return new Response(null, { status: 204 });
};
