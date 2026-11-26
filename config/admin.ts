export default ({ env }) => ({
	url: '/admin',
	host: env('HOST', '0.0.0.0'),
	port: env.int('PORT', 1337),
	auth: {
		secret: env('ADMIN_JWT_SECRET'),
		sessions: {
			maxRefreshTokenLifespan: 30 * 24 * 60 * 60,
			maxSessionLifespan: 24 * 60 * 60,
		},
	},
	apiToken: {
		salt: env('API_TOKEN_SALT'),
	},
	transfer: {
		token: {
			salt: env('TRANSFER_TOKEN_SALT'),
		},
	},
	// Encrypts API tokens at rest so the admin can show them again; without it Strapi only warns.
	secrets: {
		encryptionKey: env('ENCRYPTION_KEY'),
	},
	flags: {
		nps: false,
		promoteEE: false,
	},
	auditLogs: {
		enabled: false,
	},
	// Content Preview is unused; disable it so the admin never calls the preview
	// service (which throws "Preview config not found" when no handler is set).
	preview: {
		enabled: false,
	},
});
