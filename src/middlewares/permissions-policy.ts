/** Browser features neither the admin panel nor the API use, denied to the page and its frames. */
const PERMISSIONS_POLICY = 'camera=(), geolocation=(), microphone=(), payment=(), usb=()';

/**
 * Sends `Permissions-Policy` on every response; `strapi::security` (helmet) does not set it.
 * @returns The Koa middleware.
 */
export default () => async (ctx, next) => {
	ctx.set('Permissions-Policy', PERMISSIONS_POLICY);
	await next();
};
