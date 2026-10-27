import { isKnownNoise } from '../src/sentry-noise';
import { LOCAL_UPLOAD_STATIC_OPTIONS } from './asset-cache';
import { UPLOAD_ALLOWED_TYPES, UPLOAD_SIZE_LIMIT } from './upload-limits';
import { r2ProviderOptions, UPLOAD_STORAGE } from './upload-storage';

export default ({ env }) => ({
	'users-permissions': {
		config: {
			jwt: {
				expiresIn: '7d',
			},
			register: {
				// Do not allow `role` — clients must never self-assign roles at registration.
				allowedFields: [],
			},
		},
	},
	email: {
		config: {
			provider: 'nodemailer',
			providerOptions: {
				host: env('SMTP_HOST', 'smtp.example.com'),
				port: env.int('SMTP_PORT', 465),
				secure: env.bool('SMTP_SECURE', true),
				auth: {
					user: env('SMTP_USERNAME'),
					pass: env('SMTP_PASSWORD'),
				},
			},
			settings: {
				defaultFrom: 'not-reply@your-project.fr',
				defaultReplyTo: 'not-reply@your-project.fr',
			},
		},
	},
	upload: {
		config: {
			sizeLimit: UPLOAD_SIZE_LIMIT,
			security: {
				allowedTypes: UPLOAD_ALLOWED_TYPES,
			},
			// R2 when S3_UPLOAD_BUCKET is set, the local disk otherwise (see `upload-storage.ts`).
			...(UPLOAD_STORAGE.kind === 'r2'
				? { provider: 'aws-s3', providerOptions: r2ProviderOptions(UPLOAD_STORAGE) }
				: { providerOptions: { localServer: LOCAL_UPLOAD_STATIC_OPTIONS } }),
		},
	},
	sentry: {
		// Only report from production with a DSN; dev/staging noise stays out of the dashboard.
		enabled: env('NODE_ENV') === 'production' && Boolean(env('SENTRY_DSN')),
		config: {
			dsn: env('SENTRY_DSN'),
			sendMetadata: true,
			init: {
				// Tag each event with the deployed commit so an error maps back to the
				// release that introduced it (SOURCE_COMMIT is set by Coolify at runtime).
				release: env('SENTRY_RELEASE', env('SOURCE_COMMIT')),
				// Drop the answers Strapi gives a visitor (refusals, 400s, failed logins, path
				// traversals) before they reach Sentry. The rules are exact matches, tested in
				// `tests/sentry-noise.test.ts`.
				beforeSend: (event, hint) => {
					const original = hint?.originalException;
					const error = original instanceof Error ? original : undefined;
					const exception = event.exception?.values?.[0];
					const name = error?.name ?? exception?.type;
					const message = error?.message ?? exception?.value;
					return isKnownNoise(name, message, event) ? null : event;
				},
			},
		},
	},
});
