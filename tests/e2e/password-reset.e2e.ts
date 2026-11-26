import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

import { type App, expect, test } from 'e2e';

import { messagesTo, messageText } from './mail';
import {
	type AuthResponse,
	api,
	bearer,
	DB_CONTAINER,
	registerUser,
	ROLES,
	sendJson,
	USER_PASSWORD,
} from './support';

/** Generated per run: a throwaway test value, never a literal in the source. */
const NEW_PASSWORD = `Reset-${randomBytes(12).toString('base64url')}-9a`;

/**
 * Runs one SQL statement on the throwaway database, for the states the API cannot reach: a code
 * issued hours ago, a blocked account.
 * @param sql - The statement; the suite's emails come from `uniqueEmail` and need no escaping.
 * @returns What psql printed.
 */
function runSql(sql: string): string {
	return execFileSync(
		'docker',
		['exec', '-i', DB_CONTAINER, 'psql', '-U', 'strapi', '-d', 'strapi', '-v', 'ON_ERROR_STOP=1'],
		{ encoding: 'utf8', input: sql },
	).trim();
}

/**
 * Requests a reset code through `/auth/forgot-password` and reads it from the mail Strapi sent.
 * @param app - The `app` fixture.
 * @param email - The user's email.
 * @returns The code `/auth/reset-password` accepts.
 */
async function requestResetCode(app: App, email: string): Promise<string> {
	const seen = await messagesTo(email);
	const response = await sendJson(app, 'POST', '/api/auth/forgot-password', { email });
	expect(response.status).toBe(200);
	const fresh = (await messagesTo(email)).find((id) => !seen.includes(id));
	if (fresh === undefined) throw new Error(`no reset mail to ${email}`);
	const code = /code=([0-9a-f]+)/.exec(await messageText(fresh))?.[1];
	if (code === undefined) throw new Error('the reset mail carries no code');
	return code;
}

/**
 * Moves the issue time of the user's current code two hours back, past its one-hour lifetime.
 * @param email - The user's email.
 */
function ageResetCode(email: string): void {
	const output = runSql(
		`UPDATE up_users SET reset_password_requested_at = now() - interval '2 hours' WHERE email = '${email}';`,
	);
	expect(output).toBe('UPDATE 1');
}

function resetPassword(app: App, code: string): Promise<Response> {
	return sendJson(app, 'POST', '/api/auth/reset-password', {
		code,
		password: NEW_PASSWORD,
		passwordConfirmation: NEW_PASSWORD,
	});
}

test('a password reset revokes the JWTs issued before it', { session: ROLES }, async ({ app }) => {
	const user = await registerUser(app);
	const before = await api(app, '/api/users/me', { headers: bearer(user.jwt) });
	expect(before.status).toBe(200);
	// A JWT's `iat` is in seconds and the check compares whole seconds: change the password in a later one.
	await sleep(1100);

	const code = await requestResetCode(app, user.email);
	const reset = await resetPassword(app, code);
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

test('a reset code older than one hour is refused', { session: ROLES }, async ({ app }) => {
	const user = await registerUser(app);
	const code = await requestResetCode(app, user.email);
	ageResetCode(user.email);

	const reset = await resetPassword(app, code);
	expect(reset.status).toBe(400);
	const login = await sendJson(app, 'POST', '/api/auth/local', {
		identifier: user.email,
		password: USER_PASSWORD,
	});
	expect(login.status).toBe(200);
});

test('a write that rotates no code never extends an expired one', { session: ROLES }, async ({ app }) => {
	const user = await registerUser(app);
	const code = await requestResetCode(app, user.email);
	ageResetCode(user.email);

	// The member's own update, even one that names the stamp, leaves the code as it was.
	const update = await sendJson(
		app,
		'PUT',
		`/api/users/${user.user.id}`,
		{ username: `renamed_${user.user.id}`, resetPasswordRequestedAt: new Date().toISOString() },
		bearer(user.jwt),
	);
	expect(update.status).toBe(200);
	// A blocked account gets no new code from `/auth/forgot-password`, which still answers 200.
	expect(runSql(`UPDATE up_users SET blocked = true WHERE email = '${user.email}';`)).toBe('UPDATE 1');
	const seen = await messagesTo(user.email);
	const blocked = await sendJson(app, 'POST', '/api/auth/forgot-password', { email: user.email });
	expect(blocked.status).toBe(200);
	expect(await messagesTo(user.email)).toEqual(seen);
	expect(runSql(`UPDATE up_users SET blocked = false WHERE email = '${user.email}';`)).toBe('UPDATE 1');

	expect((await resetPassword(app, code)).status).toBe(400);
	const freshCode = await requestResetCode(app, user.email);
	expect((await resetPassword(app, freshCode)).status).toBe(200);
});
