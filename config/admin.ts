export default ({ env }) => ({
	url: '/admin',
	host: env('HOST', '0.0.0.0'),
	port: env.int('PORT', 1337),
	auth: {
		secret: env('ADMIN_JWT_SECRET'),
	},
	apiToken: {
		salt: env('API_TOKEN_SALT'),
	},
	transfer: {
		token: {
			salt: env('TRANSFER_TOKEN_SALT'),
		},
	},
	flags: {
		nps: false,
		promoteEE: false,
	},
	auditLogs: {
		enabled: false,
	},
});
