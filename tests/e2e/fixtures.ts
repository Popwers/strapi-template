import { type Browser, test as base } from '@e2e-dev/web';
import { type App, credentials, expect, type Screen } from 'e2e';

declare global {
	interface Window {
		__e2eFlushPageErrors?: () => void;
	}
}

/** Session saved by `admin.setup.e2e.ts`: the admin created by `serve.sh`. */
export const ADMIN = 'admin';

/**
 * `test` with a guard that fails the test on any page error `page-errors.js` recorded in the page it
 * ends on: `console.error`, uncaught errors, failed same-origin assets or 4xx/5xx responses, CSP
 * violations. A test that expects one pushes a pattern into `allowedPageErrors`, which starts with
 * the CSP eval probe of the admin bundle.
 */
export const test = base
	.extend<{ allowedPageErrors: RegExp[] }>({
		// Zod 4 in the Strapi admin bundle probes `Function` and falls back when the CSP blocks it.
		allowedPageErrors: async (_fixtures, use) => {
			await use([/^CSP script-src: eval /]);
		},
	})
	.extend<{ pageErrorGuard: undefined }>({
		pageErrorGuard: async ({ browser, allowedPageErrors }, use) => {
			await use(undefined);
			await expectNoPageErrors(browser, allowedPageErrors);
		},
	});

/**
 * Fails when the current page recorded a page error that no allowance matches.
 * @param browser - The `browser` fixture.
 * @param allowed - Patterns of expected errors.
 */
export async function expectNoPageErrors(browser: Browser, allowed: RegExp[] = []): Promise<void> {
	const errors = await browser.evaluate<string[]>(() => {
		try {
			window.__e2eFlushPageErrors?.();
			return JSON.parse(sessionStorage.getItem('__e2ePageErrors') ?? '[]');
		} catch {
			return [];
		}
	});
	const unexpected = errors.filter((error) => !allowed.some((pattern) => pattern.test(error)));
	expect(unexpected, 'console errors, failed requests and uncaught page errors').toEqual([]);
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
