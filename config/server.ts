export default ({ env }) => ({
	url: env('PUBLIC_URL', 'http://localhost:1337'),
	host: env('HOST', '0.0.0.0'),
	port: env.int('PORT', 1337),
	/**
	 * Strapi 5 hands Koa only `proxy.koa` (a bare `proxy: true` is ignored), so behind the TLS proxy
	 * `ctx.secure` reads `X-Forwarded-Proto` and the admin cookies get `Secure`. `maxIpsCount: 1`
	 * takes the address the nearest proxy appended to `X-Forwarded-For`, never one the client wrote:
	 * the login rate limits key on it. Behind Cloudflare that address is a Cloudflare edge, shared by
	 * many visitors: `TRUST_CF_CONNECTING_IP=true` reads the visitor from `CF-Connecting-IP` instead.
	 * Only when the origin accepts Cloudflare traffic alone: a client that reaches it directly can
	 * write that header.
	 */
	proxy: {
		koa: env.bool('PROXY', true),
		maxIpsCount: 1,
		ipHeader: env.bool('TRUST_CF_CONNECTING_IP', false) ? 'CF-Connecting-IP' : 'X-Forwarded-For',
	},
	app: {
		keys: env.array('APP_KEYS'),
	},
	webhooks: {
		populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
	},
});
