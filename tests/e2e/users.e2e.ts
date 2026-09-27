import { expect, test } from '@playwright/test';

import { type ApiUser, bearer, registerUser } from './support';

test('owner updates their own profile and cannot block themselves', async ({ request }) => {
	const owner = await registerUser(request);

	const update = await request.put(`/api/users/${owner.user.id}`, {
		headers: bearer(owner.jwt),
		data: { username: `renamed_${owner.user.id}`, blocked: true },
	});

	expect(update.status()).toBe(200);
	const updated: ApiUser = await update.json();
	expect(updated.username).toBe(`renamed_${owner.user.id}`);

	const me = await request.get('/api/users/me', { headers: bearer(owner.jwt) });
	expect(me.status()).toBe(200);
	expect(await me.json()).toMatchObject({ username: `renamed_${owner.user.id}`, blocked: false });
});

test('a user cannot update another user', async ({ request }) => {
	const attacker = await registerUser(request);
	const victim = await registerUser(request);

	const update = await request.put(`/api/users/${victim.user.id}`, {
		headers: bearer(attacker.jwt),
		data: { username: 'hijacked' },
	});

	expect(update.status()).toBe(403);
	const me = await request.get('/api/users/me', { headers: bearer(victim.jwt) });
	expect(await me.json()).toMatchObject({ username: victim.user.username });
});

test('an anonymous request cannot update a user', async ({ request }) => {
	const victim = await registerUser(request);

	const update = await request.put(`/api/users/${victim.user.id}`, { data: { username: 'anonymous' } });

	expect(update.status()).toBe(403);
});
