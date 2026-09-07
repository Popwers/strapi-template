type MiddlewareEntry = string | { resolve: string };

const middlewares: MiddlewareEntry[] = [
	{ resolve: 'src/middlewares/admin-redirect' },
	'strapi::logger',
	'strapi::errors',
	'strapi::security',
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
