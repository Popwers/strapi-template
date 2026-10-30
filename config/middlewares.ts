import { CSP_DEFAULTS, env } from '@strapi/utils';

import { uploadMediaOrigins } from './upload-storage';

/** Options passed through to the `strapi::security` middleware (koa-helmet). */
interface SecurityConfig {
	contentSecurityPolicy: { directives: Record<string, string[]> };
	hsts: false;
}

/** Options passed through to the `strapi::cors` middleware (@koa/cors). */
type CorsConfig = Record<'origin', string[]>;

type MiddlewareEntry =
	| string
	| { resolve: string }
	| { name: 'strapi::security'; config: SecurityConfig }
	| { name: 'strapi::cors'; config: CorsConfig };

const mediaOrigins = uploadMediaOrigins();

const middlewares: MiddlewareEntry[] = [
	{ resolve: 'src/middlewares/admin-redirect' },
	'strapi::logger',
	'strapi::errors',
	{
		name: 'strapi::security',
		config: {
			contentSecurityPolicy: {
				directives: {
					// Full lists: the middleware merges arrays by index, so a partial list would drop defaults.
					'img-src': [...CSP_DEFAULTS['img-src'], ...mediaOrigins],
					'media-src': [...CSP_DEFAULTS['media-src'], ...mediaOrigins],
				},
			},
			// The Cloudflare zone is the only HSTS source (6 months, no subdomains).
			hsts: false,
		},
	},
	{
		name: 'strapi::cors',
		// Front origins allowed to read API responses. The default (`*`) echoes any Origin with
		// credentials, and an `origin` that resolves to undefined is treated as `*`, so the fallback
		// stays a concrete dev origin (the Astro dev server). An empty value allows nobody.
		config: { origin: env.array('CORS_ORIGINS', ['http://localhost:4321']) },
	},
	'strapi::poweredBy',
	'strapi::query',
	'strapi::body',
	'strapi::session',
	// Outer so it compresses favicon and public bodies on the way out.
	'strapi::compression',
	'strapi::favicon',
	'strapi::public',
];

export default middlewares;
