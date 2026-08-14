import type { Locale } from '$lib/schemas/post';

// Replaces a leading /en or /de path segment with the given locale, leaving the rest of the path
// untouched. The lookahead anchors the match to a whole segment boundary (/ or end of string) —
// without it, /^\/(en|de)/ matches the first two characters of ANY path, so /design/blog becomes
// /XXsign/blog and /entry-level-guide gets mangled the same way.
export function swapLocale(path: string, locale: Locale): string {
	return path.replace(/^\/(en|de)(?=\/|$)/, `/${locale}`);
}
