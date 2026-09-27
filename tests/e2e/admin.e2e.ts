import { expect, type Page, test } from '@playwright/test';

import { ADMIN_EMAIL, ADMIN_PASSWORD } from './support';

function collectConsoleErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));
	return errors;
}

async function signIn(page: Page, password: string): Promise<void> {
	await page.goto('/admin');
	await expect(page).toHaveURL(/\/admin\/auth\/login/);
	await expect(page.getByRole('heading', { name: 'Welcome to Strapi!' })).toBeVisible();
	await page.getByRole('textbox', { name: 'Email' }).fill(ADMIN_EMAIL);
	await page.getByRole('textbox', { name: 'Password' }).fill(password);
	await page.getByRole('button', { name: 'Login' }).click();
}

test('an admin signs in and lands on the dashboard', async ({ page }) => {
	const consoleErrors = collectConsoleErrors(page);

	await signIn(page, ADMIN_PASSWORD);

	await expect(page.getByRole('heading', { name: /Hello E2E/ })).toBeVisible();
	expect(consoleErrors).toEqual([]);
});

test('the admin login rejects a wrong password', async ({ page }) => {
	await signIn(page, 'not-the-admin-password');

	await expect(page.getByText('Invalid credentials')).toBeVisible();
	await expect(page).toHaveURL(/\/admin\/auth\/login/);
});
