/**
 * Server-side upload limits — the single CMS source of truth for the upload plugin.
 *
 * Any front-end built on this template should mirror `UPLOAD_SIZE_LIMIT` as its per-file client
 * cap (e.g. a `MAX_FILE_SIZE` constant in the front-end uploader). The two codebases have no
 * shared package, so they must be kept in sync by hand.
 */

/** Hard per-file upload size cap (bytes). */
export const UPLOAD_SIZE_LIMIT = 15 * 1024 * 1024; // 15 MB

/**
 * MIME types accepted by the upload plugin, validated from file content (not the declared header).
 * SVG/HTML are intentionally excluded (XSS risk), executables too.
 */
export const UPLOAD_ALLOWED_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'application/pdf',
	'application/zip',
	'text/csv',
	'text/plain',
];
