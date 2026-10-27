import { CSP_DEFAULTS } from '@strapi/utils';

import { uploadMediaOrigins } from './upload-storage';

/** Options passed through to the `strapi::security` middleware (koa-helmet). */
interface SecurityConfig {
	contentSecurityPolicy: { directives: Record<string, string[]> };
	hsts: false;
}

type MiddlewareEntry = string | { resolve: string } | { name: 'strapi::security'; config: SecurityConfig };

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
	'strapi::cors',
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
