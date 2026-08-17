import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import latin from '@fontsource/inter/files/inter-latin-600-normal.woff?inline';
import latinExt from '@fontsource/inter/files/inter-latin-ext-600-normal.woff?inline';
import { error } from '@sveltejs/kit';
import { LOCALES, type Locale } from '$lib/schemas/post';
import { allSlugs, getPost } from '$lib/server/data/posts.repo';
import type { EntryGenerator, RequestHandler } from './$types';

// Generated at build time, not from an edge function. There are 20 posts in two locales, all known
// up front, so build-time generation costs nothing at runtime, avoids edge memory limits, and
// means a crawler fetching a card image hits a static file on the CDN. The assignment allows
// either approach.
export const prerender = true;

// Satori has no default font and accepts ttf/otf/woff — not woff2. @fontsource ships both, so the
// font is a declared dependency carrying its OFL licence rather than a binary committed to the
// repo, and the output is identical on every machine instead of depending on what the build box
// happens to have installed.
//
// Imported through Vite as a data URI rather than read with node:fs. Even though this route is
// prerendered and only ever runs during the build, its module is still compiled into the server
// bundle, and the Vercel adapter cannot resolve node:module or node:fs for that target: the build
// failed at the adapter step with "Could not resolve node:module" after having already written
// every image. Going through the bundler keeps the font inline and the module portable.
function decode(dataUrl: string): ArrayBuffer {
	const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (character) =>
		character.charCodeAt(0)
	);
	// .buffer, not the view: satori's `data` accepts ArrayBuffer or Buffer, not Uint8Array.
	// Uint8Array.from allocates an exactly-sized buffer, so there is nothing trailing it.
	return bytes.buffer;
}

// Both subsets, because the latin subset alone renders "Marek Dvořák" with a tofu box where the
// ř should be — the fixtures carry Czech and German names, and a card advertising the post with a
// missing glyph in the byline is worse than no card.
// The two subsets get DIFFERENT family names and are both listed in fontFamily below. Satori
// falls back across the family list for a missing glyph, but registering both under one name just
// picks the first and renders tofu — which is what the latin subset does for the r-caron.
const FONTS = [
	{ name: 'Inter', data: decode(latin), weight: 600 as const, style: 'normal' as const },
	{ name: 'InterExt', data: decode(latinExt), weight: 600 as const, style: 'normal' as const }
];

const WIDTH = 1200;
const HEIGHT = 630;

// One image per post per locale. The card is what a share preview shows, so a German page must
// not advertise itself with an English title.
export const entries: EntryGenerator = () =>
	LOCALES.flatMap((lang) => allSlugs().map((slug) => ({ lang, slug })));

export const GET: RequestHandler = async ({ params }) => {
	if (!(LOCALES as readonly string[]).includes(params.lang)) error(404, 'No such locale');

	const post = getPost(params.slug);
	if (!post) error(404, 'No such post');

	const { title } = post.translations[params.lang as Locale];
	const readingTime = `${post.readingTimeMinutes} min`;

	const svg = await satori(
		{
			type: 'div',
			props: {
				style: {
					width: '100%',
					height: '100%',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					padding: '72px',
					backgroundColor: post.coverColor,
					backgroundImage: `linear-gradient(135deg, ${post.coverColor} 0%, #0f172a 100%)`,
					color: '#f8fafc',
					fontFamily: 'Inter, InterExt'
				},
				children: [
					{ type: 'div', props: { style: { fontSize: 30, opacity: 0.75 }, children: 'Demo Co.' } },
					{
						type: 'div',
						props: {
							// Satori has no line clamping, so a long title is bounded by the box rather than
							// by a character count that would cut mid-word at an arbitrary place.
							style: { fontSize: 64, lineHeight: 1.15, maxHeight: 300, overflow: 'hidden' },
							children: title
						}
					},
					{
						type: 'div',
						props: {
							style: { fontSize: 28, opacity: 0.75 },
							children: `${post.author.name} · ${readingTime}`
						}
					}
				]
			}
		},
		{ width: WIDTH, height: HEIGHT, fonts: FONTS }
	);

	const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();

	return new Response(new Uint8Array(png), {
		headers: {
			'content-type': 'image/png',
			'cache-control': 'public, max-age=31536000, immutable'
		}
	});
};
