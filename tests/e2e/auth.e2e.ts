import { expect, test } from 'e2e';

import { adminRoleId } from './roles';
import {
	type AuthResponse,
	api,
	bearer,
	registerUser,
	sendJson,
	uniqueEmail,
	USER_PASSWORD,
} from './support';

test('register ignores role and username sent by the client', async ({ app }) => {
	const target = await registerUser(app);
	const email = uniqueEmail();

	const response = await sendJson(app, 'POST', '/api/auth/local/register', {
		email,
		password: USER_PASSWORD,
		username: 'chosen-by-client',
		role: await adminRoleId(app),
	});

	expect(response.status).toBe(200);
	const body: AuthResponse = await response.json();
	expect(body.user.email).toBe(email);
	expect(body.user.username).toMatch(/^username_[0-9a-f]{12}$/);
	expect(body.user).not.toHaveProperty('role');

	const me = await api(app, '/api/users/me', { headers: bearer(body.jwt) });
	expect(me.status).toBe(200);

	const escalation = await sendJson(
		app,
		'PUT',
		`/api/users/${target.user.id}`,
		{ username: 'taken-over' },
		bearer(body.jwt),
	);
	expect(escalation.status).toBe(403);
});

test('login returns a JWT that authenticates the user', async ({ app }) => {
	const registered = await registerUser(app);

	const login = await sendJson(app, 'POST', '/api/auth/local', {
		identifier: registered.email,
		password: USER_PASSWORD,
	});

	expect(login.status).toBe(200);
	const body: AuthResponse = await login.json();
	expect(body.jwt).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);

	const me = await api(app, '/api/users/me', { headers: bearer(body.jwt) });
	expect(me.status).toBe(200);
	expect(await me.json()).toMatchObject({ id: registered.user.id, email: registered.email });
});

test('login rejects a wrong password', async ({ app }) => {
	const registered = await registerUser(app);

	const login = await sendJson(app, 'POST', '/api/auth/local', {
		identifier: registered.email,
		password: 'not-the-password',
	});

	expect(login.status).toBe(400);
	expect(await login.json()).toMatchObject({ error: { message: 'Invalid identifier or password' } });
});
