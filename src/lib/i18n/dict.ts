import baseEn from '$lib/fixtures/i18n.en.json';
import baseDe from '$lib/fixtures/i18n.de.json';
import additionsEn from './additions.en.json';
import additionsDe from './additions.de.json';
import type { Locale } from '$lib/schemas/post';

const en = { ...baseEn, ...additionsEn };
const de = { ...baseDe, ...additionsDe };

export type MessageKey = keyof typeof en;

export const dictionaries: Record<Locale, Record<MessageKey, string>> = {
	en,
	de: de as Record<MessageKey, string>
};
