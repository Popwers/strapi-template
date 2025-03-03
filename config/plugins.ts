export default ({ env }) => ({
	'users-permissions': {
		config: {
			jwt: {
				expiresIn: '7d',
			},
			register: {
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
	/*sentry: {
		enabled: env('NODE_ENV') === 'production',
		config: {
			dsn: '',
			sendMetadata: true,
		},
	},*/
});
