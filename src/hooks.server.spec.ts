import { describe, expect, it } from 'vitest';
import { isDashboardPath } from './hooks.server';

describe('isDashboardPath', () => {
	it('gates the dashboard root', () => {
		expect(isDashboardPath('/en/dashboard', 'en')).toBe(true);
	});

	it('gates a nested dashboard path for another locale', () => {
		expect(isDashboardPath('/de/dashboard/items', 'de')).toBe(true);
	});

	it('does not gate a blog post whose slug happens to be "dashboard"', () => {
		expect(isDashboardPath('/en/blog/dashboard', 'en')).toBe(false);
	});

	it('does not gate a route that merely starts with the word "dashboard"', () => {
		expect(isDashboardPath('/en/dashboards', 'en')).toBe(false);
	});
});
