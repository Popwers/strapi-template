import { expect, test } from '@playwright/test';

import {
	ADMIN_ROLE_ID_ENV,
	type AuthResponse,
	bearer,
	registerUser,
	uniqueEmail,
	USER_PASSWORD,
} from './support';

test('register ignores role and username sent by the client', async ({ request }) => {
	const target = await registerUser(request);
	const email = uniqueEmail();

	const response = await request.post('/api/auth/local/register', {
		data: {
			email,
			password: USER_PASSWORD,
			username: 'chosen-by-client',
			role: Number(process.env[ADMIN_ROLE_ID_ENV]),
		},
	});

	expect(response.status()).toBe(200);
	const body: AuthResponse = await response.json();
	expect(body.user.email).toBe(email);
	expect(body.user.username).toMatch(/^username_[0-9a-f]{12}$/);
	expect(body.user).not.toHaveProperty('role');

	const me = await request.get('/api/users/me', { headers: bearer(body.jwt) });
	expect(me.status()).toBe(200);

	const escalation = await request.put(`/api/users/${target.user.id}`, {
		headers: bearer(body.jwt),
		data: { username: 'taken-over' },
	});
	expect(escalation.status()).toBe(403);
});

test('login returns a JWT that authenticates the user', async ({ request }) => {
	const registered = await registerUser(request);

	const login = await request.post('/api/auth/local', {
		data: { identifier: registered.email, password: USER_PASSWORD },
	});

	expect(login.status()).toBe(200);
	const body: AuthResponse = await login.json();
	expect(body.jwt).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);

	const me = await request.get('/api/users/me', { headers: bearer(body.jwt) });
	expect(me.status()).toBe(200);
	expect(await me.json()).toMatchObject({ id: registered.user.id, email: registered.email });
});

test('login rejects a wrong password', async ({ request }) => {
	const registered = await registerUser(request);

	const login = await request.post('/api/auth/local', {
		data: { identifier: registered.email, password: 'not-the-password' },
	});

	expect(login.status()).toBe(400);
	expect(await login.json()).toMatchObject({ error: { message: 'Invalid identifier or password' } });
});
