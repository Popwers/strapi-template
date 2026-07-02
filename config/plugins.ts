import { UPLOAD_ALLOWED_TYPES, UPLOAD_SIZE_LIMIT } from './upload-limits';

export default ({ env }) => ({
	'users-permissions': {
		config: {
			jwt: {
				expiresIn: '7d',
			},
			register: {
				// SECURITY: 'role' is only safe here because src/extensions/users-permissions/
				// strapi-server.ts overrides auth.register and force-rebuilds the body via
				// sanitizeUser (client role values never reach the DB). If that extension is
				// removed, this line MUST be removed too — otherwise clients can self-assign roles.
				allowedFields: ['role'],
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
			// Hard cap on upload size — single source in ./upload-limits.
			sizeLimit: UPLOAD_SIZE_LIMIT,
			// MIME validated from file content (file-type), not the declared header.
			// SVG/HTML intentionally excluded (XSS risk), executables too. See ./upload-limits.
			security: {
				allowedTypes: UPLOAD_ALLOWED_TYPES,
			},
		},
	},
	/*sentry: {
		// Only report from production; dev/staging noise stays out of the dashboard.
		enabled: env('NODE_ENV') === 'production',
		config: {
			dsn: '',
			sendMetadata: true,
			init: {
				// Tag each event with the deployed commit so an error maps back to the
				// release that introduced it (SOURCE_COMMIT is set by Coolify at runtime).
				release: env('SENTRY_RELEASE', env('SOURCE_COMMIT')),
				// Drop expected client errors before they reach Sentry — failed logins,
				// permission denials and rate limits are user/4xx noise, not server bugs.
				beforeSend: (event, hint) => {
					const error = hint?.originalException as { name?: string; message?: string } | undefined;
					const name = error?.name ?? event.exception?.values?.[0]?.type;
					const NOISE = ['UnauthorizedError', 'ForbiddenError', 'RateLimitError', 'PolicyError'];
					if (name && NOISE.includes(name)) return null;
					// Auth ValidationErrors (failed login, expired/invalid email-confirmation
					// token) are user noise; keep other ValidationErrors (real bugs).
					if (name === 'ValidationError') {
						const message = error?.message ?? event.exception?.values?.[0]?.value ?? '';
						if (
							/invalid identifier or password|invalid credentials|invalid token/i.test(message)
						) {
							return null;
						}
					}
					return event;
				},
			},
		},
	},*/
});
