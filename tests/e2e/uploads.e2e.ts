import { expect, test } from 'e2e';

import { UPLOAD_REQUEST_LIMIT } from '../../config/upload-limits';
import { adminHeaders } from './roles';
import { api, avatarPng } from './support';

interface UploadedFile {
	name: string;
}

test('the admin media field uploads several files in one request', async ({ app }) => {
	const form = new FormData();
	const names = ['first.png', 'second.png', 'third.png'];
	for (const name of names) form.append('files', avatarPng, name);

	const response = await api(app, '/upload', {
		method: 'POST',
		headers: await adminHeaders(app),
		body: form,
	});

	expect(response.status).toBe(201);
	const files: UploadedFile[] = await response.json();
	expect(files.map((file) => file.name).toSorted()).toEqual(names);
});

test('a multipart body above the per-request cap is refused before any auth', async ({ app }) => {
	const form = new FormData();
	const oversized = new Blob([new Uint8Array(UPLOAD_REQUEST_LIMIT + 1)], { type: 'image/png' });
	form.append('files', oversized, 'oversized.png');

	const response = await api(app, '/api/upload', { method: 'POST', body: form });

	expect(response.status).toBe(413);
});
