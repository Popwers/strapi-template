import { type App, expect, test } from 'e2e';

import { ADMIN_EMAIL, ADMIN_PASSWORD, sendJson, uniqueEmail } from './support';

/** Index signature keeps it assignable to `sendJson` headers. */
interface ProxyHeaders {
	[header: string]: string;
	'x-forwarded-proto': string;
	'x-forwarded-for': string;
}

/**
 * Headers the TLS proxy (Cloudflare, then Traefik) adds. The client controls everything left of
 * the last `X-Forwarded-For` entry; the last one is the address the nearest proxy saw.
 * @param clientWritten - The value a client put in its own `X-Forwarded-For`.
 * @param proxyAppended - The address the proxy appended.
 * @returns Headers for `sendJson`.
 */
function behindProxy(clientWritten: string, proxyAppended: string): ProxyHeaders {
	return { 'x-forwarded-proto': 'https', 'x-forwarded-for': `${clientWritten}, ${proxyAppended}` };
}

/**
 * Sends one admin login attempt with a wrong password.
 * @param app - The `app` fixture.
 * @param email - The address the attempt is for.
 * @param headers - Proxy headers.
 * @returns The response status.
 */
async function failedAdminLogin(app: App, email: string, headers: ProxyHeaders): Promise<number> {
	const response = await sendJson(app, 'POST', '/admin/login', { email, password: 'wrong' }, headers);
	return response.status;
}

test('behind the TLS proxy the admin refresh cookie is Secure', async ({ app }) => {
	const response = await sendJson(
		app,
		'POST',
		'/admin/login',
		{ email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
		behindProxy('198.51.100.1', '203.0.113.10'),
	);

	expect(response.status).toBe(200);
	const refresh = response.headers
		.getSetCookie()
		.find((cookie) => cookie.startsWith('strapi_admin_refresh='));
	expect(refresh).toMatch(/;\s*secure/i);
});

test('each client behind the proxy gets its own login rate-limit bucket', async ({ app }) => {
	const email = uniqueEmail();
	for (let attempt = 0; attempt < 5; attempt++) {
		expect(await failedAdminLogin(app, email, behindProxy('198.51.100.2', '203.0.113.30'))).toBe(400);
	}

	expect(await failedAdminLogin(app, email, behindProxy('198.51.100.2', '203.0.113.31'))).toBe(400);
});

test('a forged X-Forwarded-For does not reset the login rate limit', async ({ app }) => {
	const email = uniqueEmail();
	const statuses: number[] = [];
	for (let attempt = 0; attempt < 6; attempt++) {
		statuses.push(
			await failedAdminLogin(app, email, behindProxy(`198.51.100.${10 + attempt}`, '203.0.113.40')),
		);
	}

	expect(statuses.at(-1)).toBe(429);
});
