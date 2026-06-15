import { randomBytes } from 'node:crypto';

/**
 * Convert a lodash-style path string ('files.avatar', 'files[0]') into segments.
 * @param key - The multipart field name to split.
 * @returns The path segments, with empty segments removed.
 */
const toPathSegments = (key: string): string[] =>
	key
		.replace(/\[(\d+)\]/g, '.$1')
		.split('.')
		.filter(Boolean);

/**
 * Normalize a koa-body multipart `files` map, keeping only entries rooted at
 * `files.*` and remapping their keys to the remaining path (e.g. `files.avatar`
 * becomes `avatar`).
 * @param files - The raw `ctx.request.files` map.
 * @returns A map of normalized field names to their file value.
 */
const parseFiles = (files) => {
	return Object.keys(files).reduce((acc, key) => {
		const segments = toPathSegments(key);

		if (segments.length <= 1 || segments[0] !== 'files') {
			return acc;
		}

		acc[segments.slice(1).join('.')] = files[key];
		return acc;
	}, {});
};

/**
 * Generate a collision-resistant placeholder username for new accounts.
 * @returns A username of the form `username_<12 hex chars>`.
 */
const generateUser = () => `username_${randomBytes(6).toString('hex')}`;

export { generateUser, parseFiles };
