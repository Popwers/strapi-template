import { expect } from 'e2e';

import { ADMIN, signIn, test } from './fixtures';

// Runs once before the browser tests: signs in once so they restore the saved admin session.
test.setup('sign in as the admin', { sessions: [ADMIN] }, async ({ app, screen, browser, session }) => {
	await signIn(app, screen, browser);
	await expect(screen.getByRole('heading', /Hello E2E/)).toBeVisible();
	await session.save(ADMIN);
});
