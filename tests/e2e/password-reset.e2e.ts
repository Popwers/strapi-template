import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

import { expect, test } from 'e2e';

import { type AuthResponse, api, bearer, DB_CONTAINER, registerUser, ROLES, sendJson } from './support';

const NEW_PASSWORD = 'E2e-Reset-Passw0rd';

/**
 * Stores a reset code on the user, as `/auth/forgot-password` does before mailing it: the suite has
 * no mailbox to read the code from.
 * @param email - The user's email.
 * @param code - The code `/auth/reset-password` will accept.
 */
function setResetCode(email: string, code: string): void {
	const output = execFileSync(
		'docker',
		['exec', '-i', DB_CONTAINER, 'psql', '-U', 'strapi', '-d', 'strapi', '-v', 'ON_ERROR_STOP=1'],
		{
			encoding: 'utf8',
			input: `UPDATE up_users SET reset_password_token = '${code}' WHERE email = '${email}';`,
		},
	);
	expect(output.trim()).toBe('UPDATE 1');
}

test('a password reset revokes the JWTs issued before it', { session: ROLES }, async ({ app }) => {
	const user = await registerUser(app);
	const before = await api(app, '/api/users/me', { headers: bearer(user.jwt) });
	expect(before.status).toBe(200);
	// A JWT's `iat` is in seconds and the check compares whole seconds: change the password in a later one.
	await sleep(1100);

	// Hex code and a `.test` address from `uniqueEmail`: nothing to escape in the SQL literal.
	const code = randomBytes(32).toString('hex');
	setResetCode(user.email, code);
	const reset = await sendJson(app, 'POST', '/api/auth/reset-password', {
		code,
		password: NEW_PASSWORD,
		passwordConfirmation: NEW_PASSWORD,
	});
	expect(reset.status).toBe(200);
	const { jwt: resetJwt }: AuthResponse = await reset.json();

	const stale = await api(app, '/api/users/me', { headers: bearer(user.jwt) });
	expect(stale.status).toBe(401);
	const fresh = await api(app, '/api/users/me', { headers: bearer(resetJwt) });
	expect(fresh.status).toBe(200);
	const freshUser: { id: number } = await fresh.json();
	expect(freshUser.id).toBe(user.user.id);
	// The private stamp never leaves the server.
	expect(freshUser).not.toHaveProperty('passwordChangedAt');

	const login = await sendJson(app, 'POST', '/api/auth/local', {
		identifier: user.email,
		password: NEW_PASSWORD,
	});
	expect(login.status).toBe(200);
	const { jwt: loginJwt }: AuthResponse = await login.json();
	const afterLogin = await api(app, '/api/users/me', { headers: bearer(loginJwt) });
	expect(afterLogin.status).toBe(200);
});

test('a client cannot set passwordChangedAt to lock a session out', { session: ROLES }, async ({ app }) => {
	const user = await registerUser(app);

	const update = await sendJson(
		app,
		'PUT',
		`/api/users/${user.user.id}`,
		{ passwordChangedAt: '2999-01-01T00:00:00.000Z' },
		bearer(user.jwt),
	);
	expect(update.status).toBe(200);

	const me = await api(app, '/api/users/me', { headers: bearer(user.jwt) });
	expect(me.status).toBe(200);
});
