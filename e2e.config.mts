import { web } from '@e2e-dev/web';
import type { E2EConfig } from 'e2e';
import { grok } from 'e2e/oauth/grok';

import { ADMIN_EMAIL, ADMIN_PASSWORD, BASE_URL, DB_PORT, PORT, USER_PASSWORD } from './tests/e2e/support';

/**
 * Suite against the production build. `tests/e2e/serve.sh` starts a throwaway Postgres, builds
 * Strapi, creates the admin and serves it; it removes the database on exit.
 * `E2E_REUSE_SERVER=1` reuses a server already listening on the port (local iteration only).
 */
export default {
	targets: [
		{
			engine: web({
				locale: 'en-US',
				initScripts: [{ path: 'tests/e2e/page-errors.js' }],
			}),
			app: {
				url: BASE_URL,
				readyUrl: `${BASE_URL}/_health`,
				command: {
					executable: 'bash',
					args: ['tests/e2e/serve.sh'],
					startupTimeout: 240_000,
					reuseExisting: process.env.E2E_REUSE_SERVER === '1',
					log: '.e2e/logs/app.log',
					env: {
						E2E_PORT: String(PORT),
						E2E_DB_PORT: String(DB_PORT),
						E2E_ADMIN_EMAIL: ADMIN_EMAIL,
						E2E_ADMIN_PASSWORD: ADMIN_PASSWORD,
					},
				},
			},
		},
	],
	trace: 'retain-on-failure',
	credentials: {
		admin: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
	},
	secrets: {
		'new-user-password': USER_PASSWORD,
	},
	// SuperGrok subscription: sign in once with `npx e2e login spacexai`; `npx e2e models spacexai` lists the ids.
	agents: {
		default: {
			model: grok('grok-4.7'),
			system: 'You are a thorough QA agent. Verify every outcome on screen.',
			context:
				'Strapi 5 admin panel. The Content Manager lists collection types such as "User" (users-permissions). Saving an entry shows a toast notification.',
		},
	},
} satisfies E2EConfig;
