import { env } from '@strapi/utils';

/**
 * Where uploaded media lives. Production stores it in the project's `<name>-files` R2 bucket (EU
 * jurisdiction), served from its CDN domain; the local disk is for development, the e2e suite and
 * `docker compose`, which mounts `public/uploads`.
 */
interface R2Storage {
	kind: 'r2';
	bucket: string;
	endpoint: string;
	publicUrl: string;
	accessKeyId: string;
	secretAccessKey: string;
}

type UploadStorage = R2Storage | { kind: 'local' };

/**
 * Reads a variable that R2 uploads cannot work without.
 * @param name - The environment variable to read.
 * @returns Its value.
 */
function requireUploadEnv(name: string): string {
	const value = env(name, '');
	if (value === '') throw new Error(`S3_UPLOAD_BUCKET is set but ${name} is missing`);
	return value;
}

/**
 * Picks the upload storage from the environment.
 * @returns The storage the upload plugin writes to.
 */
function readUploadStorage(): UploadStorage {
	const bucket = env('S3_UPLOAD_BUCKET', '');
	if (bucket !== '') {
		return {
			kind: 'r2',
			bucket,
			endpoint: requireUploadEnv('S3_ENDPOINT'),
			publicUrl: requireUploadEnv('S3_UPLOAD_PUBLIC_URL'),
			accessKeyId: requireUploadEnv('S3_ACCESS_KEY_ID'),
			secretAccessKey: requireUploadEnv('S3_SECRET_ACCESS_KEY'),
		};
	}
	return { kind: 'local' };
}

export const UPLOAD_STORAGE = readUploadStorage();

/**
 * A container's disk is wiped on every deploy, so a production server refuses to start on local
 * storage unless `UPLOAD_LOCAL=true` says it is meant. Called at boot, not at config load, so
 * `strapi build` runs without upload variables.
 */
export function assertDurableUploadStorage(): void {
	if (UPLOAD_STORAGE.kind === 'r2' || env('NODE_ENV') !== 'production') return;
	if (env.bool('UPLOAD_LOCAL', false)) return;
	throw new Error('Set S3_UPLOAD_BUCKET (R2 uploads) or UPLOAD_LOCAL=true in production');
}

/**
 * Origins the admin loads media previews from, for the `img-src` and `media-src` CSP directives.
 * @returns The CDN origin of the files bucket, or nothing on local storage.
 */
export function uploadMediaOrigins(): string[] {
	if (UPLOAD_STORAGE.kind === 'local') return [];
	return [new URL(UPLOAD_STORAGE.publicUrl).origin];
}

/**
 * `providerOptions` of the `aws-s3` upload provider for an R2 bucket.
 * @param storage - The R2 bucket read from the environment.
 * @returns The options the provider builds its S3 client and file URLs from.
 */
export function r2ProviderOptions(storage: R2Storage) {
	return {
		// Object URLs point at the bucket's CDN domain; the bucket itself stays private.
		baseUrl: storage.publicUrl,
		s3Options: {
			region: 'auto',
			endpoint: storage.endpoint,
			// `<account>.eu.r2.cloudflarestorage.com/<bucket>`, no per-bucket subdomain.
			forcePathStyle: true,
			credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
			params: {
				Bucket: storage.bucket,
				// R2 has no object ACLs; an explicit undefined stops the provider sending `public-read`.
				ACL: undefined,
			},
		},
	};
}
