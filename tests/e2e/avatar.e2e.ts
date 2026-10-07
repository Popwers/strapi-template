import { expect, test } from 'e2e';

import { api, avatarPng, bearer, registerUser, ROLES } from './support';

interface UserWithAvatar {
	avatar: { url: string; mime: string } | null;
}

function avatarForm(field: string): FormData {
	const form = new FormData();
	form.append(field, avatarPng, 'avatar.png');
	return form;
}

test(
	'uploads an avatar sent as files.avatar and serves it with a long cache',
	{ session: ROLES },
	async ({ app }) => {
		const user = await registerUser(app);

		const upload = await api(app, '/api/users/avatar', {
			method: 'POST',
			headers: bearer(user.jwt),
			body: avatarForm('files.avatar'),
		});
		expect(upload.status).toBe(200);

		const me = await api(app, '/api/users/me?populate=avatar', { headers: bearer(user.jwt) });
		const body: UserWithAvatar = await me.json();
		const avatar = body.avatar;
		if (!avatar) throw new Error('user has no avatar after upload');
		expect(avatar.mime).toBe('image/png');
		expect(avatar.url).toMatch(/^\/uploads\/.+\.png$/);

		const file = await api(app, avatar.url);
		expect(file.status).toBe(200);
		expect(file.headers.get('content-type')).toBe('image/png');
		expect(file.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
	},
);

test('rejects a file field that is not under files.', { session: ROLES }, async ({ app }) => {
	const user = await registerUser(app);

	const upload = await api(app, '/api/users/avatar', {
		method: 'POST',
		headers: bearer(user.jwt),
		body: avatarForm('avatar'),
	});

	expect(upload.status).toBe(400);
	expect(await upload.json()).toMatchObject({ error: { message: 'No avatar provided' } });
});

test('rejects an anonymous avatar upload', { session: ROLES }, async ({ app }) => {
	const upload = await api(app, '/api/users/avatar', { method: 'POST', body: avatarForm('files.avatar') });

	expect(upload.status).toBe(403);
});
