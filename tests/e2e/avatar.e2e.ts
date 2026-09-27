import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { bearer, registerUser } from './support';

const avatarPng = {
	name: 'avatar.png',
	mimeType: 'image/png',
	buffer: readFileSync(path.join(__dirname, '../../favicon.png')),
};

interface UserWithAvatar {
	avatar: { url: string; mime: string } | null;
}

test('uploads an avatar sent as files.avatar and serves it with a long cache', async ({ request }) => {
	const user = await registerUser(request);

	const upload = await request.post('/api/users/avatar', {
		headers: bearer(user.jwt),
		multipart: { 'files.avatar': avatarPng },
	});
	expect(upload.status()).toBe(200);

	const me = await request.get('/api/users/me?populate=avatar', { headers: bearer(user.jwt) });
	const body: UserWithAvatar = await me.json();
	const avatar = body.avatar;
	if (!avatar) throw new Error('user has no avatar after upload');
	expect(avatar.mime).toBe('image/png');
	expect(avatar.url).toMatch(/^\/uploads\/.+\.png$/);

	const file = await request.get(avatar.url);
	expect(file.status()).toBe(200);
	expect(file.headers()['content-type']).toBe('image/png');
	expect(file.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
});

test('rejects a file field that is not under files.', async ({ request }) => {
	const user = await registerUser(request);

	const upload = await request.post('/api/users/avatar', {
		headers: bearer(user.jwt),
		multipart: { avatar: avatarPng },
	});

	expect(upload.status()).toBe(400);
	expect(await upload.json()).toMatchObject({ error: { message: 'No avatar provided' } });
});

test('rejects an anonymous avatar upload', async ({ request }) => {
	const upload = await request.post('/api/users/avatar', { multipart: { 'files.avatar': avatarPng } });

	expect(upload.status()).toBe(403);
});
