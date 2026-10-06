import { type Browser, test as base } from '@e2e-dev/web';
import { type App, credentials, expect, type Screen } from 'e2e';

/** Session saved by `admin.setup.e2e.ts`: the admin created by `serve.sh`. */
export const ADMIN = 'admin';

/**
 * `test` with a guard that fails the test on any `console.error` or uncaught page error that
 * `page-errors.js` recorded in the page it ends on.
 */
export const test = base.extend<{ pageErrorGuard: undefined }>({
	pageErrorGuard: async ({ browser }, use) => {
		await use(undefined);
		await expectNoPageErrors(browser);
	},
});

/** Fails when the current page recorded a `console.error` or uncaught error. */
export async function expectNoPageErrors(browser: Browser): Promise<void> {
	const errors = await browser.evaluate<string[]>(() => {
		try {
			return JSON.parse(sessionStorage.getItem('__e2ePageErrors') ?? '[]');
		} catch {
			return [];
		}
	});
	expect(errors, 'console errors and uncaught page errors').toEqual([]);
}

/** Opens the admin login form and submits `password` for the `admin` credentials account. */
export async function signIn(app: App, screen: Screen, browser: Browser, password?: string): Promise<void> {
	const admin = credentials.user(ADMIN);
	await app.open('/admin');
	await expect(browser).toHaveURL(/\/admin\/auth\/login/);
	await expect(screen.getByRole('heading', 'Welcome to Strapi!')).toBeVisible();
	await screen.getByRole('textbox', 'Email').fill(admin.username);
	await screen.getByLabel('Password').fill(password ?? admin.password);
	await screen.getByRole('button', 'Login').tap();
}
