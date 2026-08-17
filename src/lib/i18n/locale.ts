import { LOCALES, type Locale } from '$lib/schemas/post';

/**
 * Resolves the locale for a load, from the ROUTE PARAM rather than from `locals`.
 *
 * hooks.server.ts derives the same value and puts it on `locals`, which is where every load used
 * to read it. That is invisible to SvelteKit: a load that touches only `locals` has no tracked
 * dependency, so a client-side navigation from /en/search to /de/search — which changes nothing
 * except the locale segment — re-ran no load at all and the page went on rendering the previous
 * language until a full reload. Reading `params.lang` is what makes the dependency real.
 *
 * The fallback covers `/`, which matches the optional group with no segment at all.
 */
export function localeFromParams(lang: string | undefined, fallback: Locale): Locale {
	return lang && (LOCALES as readonly string[]).includes(lang) ? (lang as Locale) : fallback;
}
