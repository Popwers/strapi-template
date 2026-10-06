import { expect } from 'e2e';

import { ADMIN, signIn, test } from './fixtures';
import { configureRoles } from './roles';

// Runs once before every other test: grants the API roles the suite relies on (the runner has
// no global setup), then signs in once so later tests restore the saved admin session.
test.setup(
	'configure roles and sign in as the admin',
	{ sessions: [ADMIN] },
	async ({ app, screen, browser, session }) => {
		await configureRoles(app);
		await signIn(app, screen, browser);
		await expect(screen.getByRole('heading', /Hello E2E/)).toBeVisible();
		await session.save(ADMIN);
	},
);
