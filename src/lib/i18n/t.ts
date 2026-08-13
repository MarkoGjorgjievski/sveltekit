import type { Locale } from '$lib/schemas/post';
import { dictionaries, type MessageKey } from './dict';

export type { MessageKey };

export function t(
	locale: Locale,
	key: MessageKey,
	vars: Record<string, string | number> = {}
): string {
	const template = dictionaries[locale][key];
	return template.replace(/\{(\w+)\}/g, (match, name: string) =>
		name in vars ? String(vars[name]) : match
	);
}
