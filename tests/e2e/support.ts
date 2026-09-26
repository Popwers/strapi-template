import { randomUUID } from 'node:crypto';

import { type APIRequestContext, expect } from '@playwright/test';

export const BASE_URL = `http://127.0.0.1:${process.env.E2E_PORT ?? '1347'}`;

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@e2e.test';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'E2eAdmin-Passw0rd';

/** Set by global-setup: id of a users-permissions role whose type is `admin`. */
export const ADMIN_ROLE_ID_ENV = 'E2E_ADMIN_ROLE_ID';

export const USER_PASSWORD = 'E2e-User-Passw0rd';

export interface ApiUser {
	id: number;
	documentId: string;
	username: string;
	email: string;
}

export interface AuthResponse {
	jwt: string;
	user: ApiUser;
}

/** Index signature keeps it assignable to Playwright's `headers` option. */
export interface AuthHeaders {
	[header: string]: string;
	authorization: string;
}

export interface RegisteredUser {
	jwt: string;
	user: ApiUser;
	email: string;
}

/**
 * Builds an email no other test or run has used, so every test owns its user.
 * @returns A unique address on the reserved `.test` TLD.
 */
export function uniqueEmail(): string {
	return `user-${randomUUID()}@e2e.test`;
}

/**
 * Registers a fresh user through the public register endpoint.
 * @param request - Playwright request context bound to the Strapi base URL.
 * @returns The JWT and user returned by Strapi, plus the email used.
 */
export async function registerUser(request: APIRequestContext): Promise<RegisteredUser> {
	const email = uniqueEmail();
	const response = await request.post('/api/auth/local/register', {
		data: { email, password: USER_PASSWORD },
	});
	expect(response.status()).toBe(200);
	const body: AuthResponse = await response.json();
	return { jwt: body.jwt, user: body.user, email };
}

/**
 * Builds the Authorization header for a users-permissions JWT.
 * @param jwt - Token returned by register or login.
 * @returns Headers to pass to a Playwright request.
 */
export function bearer(jwt: string): AuthHeaders {
	return { authorization: `Bearer ${jwt}` };
}
