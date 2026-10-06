import { expect, test } from 'e2e';

import { type ApiUser, api, bearer, registerUser, sendJson } from './support';

test('owner updates their own profile and cannot block themselves', async ({ app }) => {
	const owner = await registerUser(app);

	const update = await sendJson(
		app,
		'PUT',
		`/api/users/${owner.user.id}`,
		{ username: `renamed_${owner.user.id}`, blocked: true },
		bearer(owner.jwt),
	);

	expect(update.status).toBe(200);
	const updated: ApiUser = await update.json();
	expect(updated.username).toBe(`renamed_${owner.user.id}`);

	const me = await api(app, '/api/users/me', { headers: bearer(owner.jwt) });
	expect(me.status).toBe(200);
	expect(await me.json()).toMatchObject({ username: `renamed_${owner.user.id}`, blocked: false });
});

test('a user cannot update another user', async ({ app }) => {
	const attacker = await registerUser(app);
	const victim = await registerUser(app);

	const update = await sendJson(
		app,
		'PUT',
		`/api/users/${victim.user.id}`,
		{ username: 'hijacked' },
		bearer(attacker.jwt),
	);

	expect(update.status).toBe(403);
	const me = await api(app, '/api/users/me', { headers: bearer(victim.jwt) });
	expect(await me.json()).toMatchObject({ username: victim.user.username });
});

test('an anonymous request cannot update a user', async ({ app }) => {
	const victim = await registerUser(app);

	const update = await sendJson(app, 'PUT', `/api/users/${victim.user.id}`, { username: 'anonymous' });

	expect(update.status).toBe(403);
});
