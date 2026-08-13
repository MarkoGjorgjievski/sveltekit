import type { Locale } from '$lib/schemas/post';

const TAGS: Record<Locale, string> = { en: 'en-GB', de: 'de-DE' };

export function formatDate(iso: string, locale: Locale): string {
	return new Intl.DateTimeFormat(TAGS[locale], {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(new Date(iso));
}

export function formatCurrency(amount: number, locale: Locale): string {
	return new Intl.NumberFormat(TAGS[locale], {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0
	}).format(amount);
}

export function formatPercent(ratio: number, locale: Locale): string {
	return new Intl.NumberFormat(TAGS[locale], {
		style: 'percent',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(ratio);
}
