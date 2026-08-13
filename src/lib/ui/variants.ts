type Groups = Record<string, Record<string, string>>;

export function variants<G extends Groups>(
	base: string,
	groups: G,
	picked: { [K in keyof G]?: keyof G[K] },
	extra?: string
): string {
	const parts = [base];
	for (const group of Object.keys(groups) as (keyof G)[]) {
		const choice = picked[group];
		if (choice !== undefined) parts.push(groups[group][choice as string]);
	}
	if (extra) parts.push(extra);
	return parts.filter(Boolean).join(' ');
}
