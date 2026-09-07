import type { ServerResponse } from 'node:http';

/** Cache lifetime for uniquely named static files, in seconds (1 year). */
export const HASHED_ASSET_MAX_AGE_SECONDS = 31_536_000;

/** koa-static `maxage` is milliseconds. */
export const HASHED_ASSET_MAX_AGE_MS = HASHED_ASSET_MAX_AGE_SECONDS * 1000;

/** HTTP Cache-Control for hashed admin chunks and uniquely named uploads. */
export const HASHED_ASSET_CACHE_CONTROL = `public, max-age=${HASHED_ASSET_MAX_AGE_SECONDS}, immutable`;

/**
 * Writes the long-lived immutable Cache-Control header onto a Node response.
 * @param res - The raw Node HTTP response (`koa-static` `setHeaders`).
 */
export function setHashedAssetCacheHeaders(res: ServerResponse): void {
	res.setHeader('Cache-Control', HASHED_ASSET_CACHE_CONTROL);
}

/** `plugin::upload` `providerOptions.localServer` passed through to `koa-static`. */
export const LOCAL_UPLOAD_STATIC_OPTIONS = {
	maxage: HASHED_ASSET_MAX_AGE_MS,
	setHeaders: setHashedAssetCacheHeaders,
};
