// Strapi allows 5 admin logins per 5 minutes per address: the real sign-in happens once in
// `admin.setup.e2e.ts`, the API login in `roles.ts` twice (setup and `auth.e2e.ts`), this file adds one.
import { expect } from 'e2e';

import { ADMIN, signIn, test } from './fixtures';

test('the admin login rejects a wrong password', async ({ app, screen, browser }) => {
	await signIn(app, screen, browser, 'not-the-admin-password');

	await expect(screen.getByText('Invalid credentials')).toBeVisible();
	await expect(browser).toHaveURL(/\/admin\/auth\/login/);
});

test('the saved session opens the dashboard', { session: ADMIN }, async ({ app, screen }) => {
	await app.open('/admin');

	await expect(screen.getByRole('heading', /Hello E2E/)).toBeVisible();
});
