import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { type App, expect } from 'e2e';

export const PORT = Number(process.env.E2E_PORT ?? '1347');
export const DB_PORT = Number(process.env.E2E_DB_PORT ?? '5447');
export const BASE_URL = `http://127.0.0.1:${PORT}`;

/** Throwaway admin created by `serve.sh`; the database is removed when the run ends. */
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@e2e.test';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'E2eAdmin-Passw0rd';

/** Session saved by `roles.setup.e2e.ts`: API tests declare it to get the role grants first. */
export const ROLES = 'roles';

export const USER_PASSWORD = 'E2e-User-Passw0rd';

export const avatarPng = new Blob([readFileSync(new URL('../../favicon.png', import.meta.url))], {
	type: 'image/png',
});

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

/** Index signature keeps it assignable to `fetch` headers. */
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
 * Requests `path` on the app under test.
 * @param app - The `app` fixture.
 * @param path - Path and query, relative to the app URL.
 * @param init - Standard `fetch` options.
 * @returns The raw response.
 */
export function api(app: App, path: string, init?: RequestInit): Promise<Response> {
	if (app.baseUrl === undefined) throw new Error('the target declares no app.url');
	return fetch(new URL(path, app.baseUrl), init);
}

/**
 * Builds an email no other test or run has used, so every test owns its user.
 * @returns A unique address on the reserved `.test` TLD.
 */
export function uniqueEmail(): string {
	return `user-${randomUUID()}@e2e.test`;
}

/**
 * Builds the Authorization header for a users-permissions JWT.
 * @param jwt - Token returned by register or login.
 * @returns Headers to pass to `api`.
 */
export function bearer(jwt: string): AuthHeaders {
	return { authorization: `Bearer ${jwt}` };
}

/**
 * Registers a fresh user through the public register endpoint.
 * @param app - The `app` fixture.
 * @returns The JWT and user returned by Strapi, plus the email used.
 */
export async function registerUser(app: App): Promise<RegisteredUser> {
	const email = uniqueEmail();
	const response = await sendJson(app, 'POST', '/api/auth/local/register', {
		email,
		password: USER_PASSWORD,
	});
	expect(response.status).toBe(200);
	const body: AuthResponse = await response.json();
	return { jwt: body.jwt, user: body.user, email };
}

/**
 * Sends a JSON body.
 * @param app - The `app` fixture.
 * @param method - HTTP method.
 * @param path - Path relative to the app URL.
 * @param data - Value serialized as the JSON body.
 * @param headers - Extra headers, such as `bearer(jwt)`.
 * @returns The raw response.
 */
export function sendJson<Body>(
	app: App,
	method: 'POST' | 'PUT',
	path: string,
	data: Body,
	headers: Record<string, string> = {},
): Promise<Response> {
	return api(app, path, {
		method,
		headers: { 'content-type': 'application/json', ...headers },
		body: JSON.stringify(data),
	});
}
