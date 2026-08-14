import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = ({ url }) =>
	new Response(
		`User-agent: *\nAllow: /\nDisallow: /en/dashboard\nDisallow: /de/dashboard\nDisallow: /en/login\nDisallow: /de/login\n\nSitemap: ${url.origin}/sitemap.xml\n`,
		{ headers: { 'content-type': 'text/plain' } }
	);
