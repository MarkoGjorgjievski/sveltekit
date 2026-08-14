import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Oklch = [number, number, number];

function parseTokens(block: string): Record<string, Oklch> {
	const out: Record<string, Oklch> = {};
	for (const line of block.split('\n')) {
		const match = line.match(/--(color-[\w-]+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/);
		if (match) out[match[1]] = [Number(match[2]) / 100, Number(match[3]), Number(match[4])];
	}
	return out;
}

function toLinearRgb([lightness, chroma, hue]: Oklch): [number, number, number] {
	const h = (hue * Math.PI) / 180;
	const a = chroma * Math.cos(h);
	const b = chroma * Math.sin(h);
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const clamp = (v: number) => Math.min(1, Math.max(0, v));
	return [
		clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
	];
}

function contrast(foreground: Oklch, background: Oklch): number {
	const luminance = (colour: Oklch) => {
		const [r, g, b] = toLinearRgb(colour);
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
	return (lighter + 0.05) / (darker + 0.05);
}

const css = readFileSync('src/routes/layout.css', 'utf8');
const light = parseTokens(css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? '');
const dark = {
	...light,
	...parseTokens(css.match(/\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? '')
};

// [foreground, background, minimum ratio, what it is]
const PAIRS: [string, string, number, string][] = [
	['color-ink', 'color-bg', 4.5, 'body text on the page'],
	['color-ink', 'color-surface', 4.5, 'body text on a card'],
	['color-ink-muted', 'color-surface', 4.5, 'muted text on a card'],
	['color-ink-muted', 'color-surface-muted', 4.5, 'muted text on a subtle fill'],
	['color-accent-foreground', 'color-accent', 4.5, 'primary button label'],
	['color-danger-foreground', 'color-danger-ink', 4.5, 'danger button label'],
	['color-accent-ink', 'color-accent-surface', 4.5, 'accent text on accent fill'],
	['color-success-ink', 'color-success-surface', 4.5, 'success badge'],
	['color-warning-ink', 'color-warning-surface', 4.5, 'warning badge'],
	['color-danger-ink', 'color-danger-surface', 4.5, 'danger badge'],
	['color-border-strong', 'color-surface', 3, 'control border (SC 1.4.11)']
];

describe.each([
	['light', light],
	['dark', dark]
])('%s theme meets WCAG AA', (_theme, tokens) => {
	it.each(PAIRS)('%s on %s >= %s:1 — %s', (fg, bg, minimum, label) => {
		expect(tokens[fg], `token --${fg} not found`).toBeDefined();
		expect(tokens[bg], `token --${bg} not found`).toBeDefined();
		const ratio = contrast(tokens[fg], tokens[bg]);
		expect(ratio, `${label}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimum);
	});
});
