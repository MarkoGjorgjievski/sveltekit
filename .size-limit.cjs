// Bundle budgets, computed from the build rather than globbed.
//
// The obvious configuration — chunks/*.js for "public" and nodes/*.js for "dashboard" — measures
// neither. chunks/ holds every chunk in the application including dashboard-only ones, and nodes/
// holds all thirteen routes, so both numbers are "the whole app" wearing a route's name and
// neither can tell you that a route regressed.
//
// What a browser actually downloads for a route is the two entry files plus that route's layout
// chain and leaf, plus the transitive closure of their STATIC imports — dynamic imports are lazy
// by definition and are not part of an initial payload. Vite's client manifest records exactly
// that graph, and filenames are content-hashed, so the list has to be computed per build.
//
// The method is verified: the closure below reproduces the 18 files referenced by the prerendered
// landing page's HTML exactly, with no file in one set and not the other.

const { readFileSync } = require('node:fs');

const CLIENT_DIR = '.svelte-kit/output/client';
const CLIENT_MANIFEST = `${CLIENT_DIR}/.vite/manifest.json`;
const SERVER_MANIFEST = '.svelte-kit/output/server/manifest-full.js';

function read(path) {
	try {
		return readFileSync(path, 'utf8');
	} catch {
		throw new Error(`Missing ${path} — run \`npm run build\` before \`npm run size\`.`);
	}
}

const manifest = JSON.parse(read(CLIENT_MANIFEST));
const serverManifest = read(SERVER_MANIFEST);

const APP = '.svelte-kit/generated/client-optimized/app.js';
const START = 'node_modules/@sveltejs/kit/src/runtime/client/entry.js';
const node = (index) => `.svelte-kit/generated/client-optimized/nodes/${index}.js`;

// Read the layout chain and leaf out of the build instead of hardcoding indices. Node numbers
// shift whenever a route is added or a layout is introduced, and a stale literal here would keep
// passing while quietly measuring some other route.
function routeNodes(routeId) {
	const marker = `id: ${JSON.stringify(routeId)},`;
	const at = serverManifest.indexOf(marker);
	if (at < 0) throw new Error(`Route ${routeId} is not in ${SERVER_MANIFEST}`);

	const entry = serverManifest
		.slice(at, at + 600)
		.match(/page: \{ layouts: \[([0-9,\s]*)\], errors: \[[^\]]*\], leaf: (\d+) \}/);
	if (!entry) throw new Error(`Route ${routeId} has no page entry — is it an endpoint?`);

	const layouts = entry[1]
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean)
		.map(Number);

	return [...layouts, Number(entry[2])];
}

function initialPayload(routeId) {
	const visited = new Set();
	const files = new Set();

	function walk(key) {
		if (visited.has(key)) return;
		visited.add(key);

		const entry = manifest[key];
		if (!entry) throw new Error(`Client manifest has no entry for ${key}`);

		files.add(`${CLIENT_DIR}/${entry.file}`);
		for (const imported of entry.imports ?? []) walk(imported);
	}

	[APP, START, ...routeNodes(routeId).map(node)].forEach(walk);
	return [...files];
}

module.exports = [
	{
		// The assignment's ceiling is 80 kB; the app ships ~48 kB. Budgeting at the ceiling would let
		// a regression add 30 kB and still pass, so this sits just above what is actually shipped.
		name: 'public initial JS (landing)',
		path: initialPayload('/[[lang=locale]]'),
		gzip: true,
		limit: '50 kB'
	},
	{
		// The assignment's ceiling is 150 kB; the app ships ~72 kB.
		name: 'dashboard initial JS (items table)',
		path: initialPayload('/[[lang=locale]]/dashboard/items'),
		gzip: true,
		limit: '74 kB'
	}
];
