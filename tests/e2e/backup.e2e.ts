import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

import { expect, test } from 'e2e';

import { api, avatarPng, BACKUP_BUCKET, bearer, registerUser, ROLES, S3_PORT } from './support';

const ARCHIVE_KEY = /^backup-strapi-(\d+)\.tar\.gz$/;

/**
 * Lists the keys of the mock backups bucket.
 * @returns Every object key, in listing order.
 */
async function listBackupKeys(): Promise<string[]> {
	const response = await fetch(`http://127.0.0.1:${S3_PORT}/${BACKUP_BUCKET}/?list-type=2`);
	const listing = await response.text();
	return [...listing.matchAll(/<Key>([^<]+)<\/Key>/g)].map((match) => match[1] ?? '');
}

/**
 * Lists the entries of the newest Strapi archive started after `since`.
 * @param since - Epoch milliseconds the archive must be newer than.
 * @returns The archive's entry paths, or an empty list while no such archive exists.
 */
async function newestArchiveEntries(since: number): Promise<string[]> {
	const key = (await listBackupKeys())
		.filter((candidate) => Number(ARCHIVE_KEY.exec(candidate)?.[1] ?? 0) > since)
		.sort()
		.at(-1);
	if (key === undefined) return [];
	const archive = await fetch(`http://127.0.0.1:${S3_PORT}/${BACKUP_BUCKET}/${key}`);
	const bytes = Buffer.from(await archive.arrayBuffer());
	return execFileSync('tar', ['-tzf', '-'], { input: bytes, encoding: 'utf8' }).split('\n');
}

test(
	'the backup cron archives the media library and the server keeps serving',
	{ session: ROLES, timeout: 90_000 },
	async ({ app }) => {
		// A file in the media library: the export must carry it, as it carries `<name>-files` on R2.
		const user = await registerUser(app);
		const form = new FormData();
		form.append('files.avatar', avatarPng, 'avatar.png');
		const upload = await api(app, '/api/users/avatar', {
			method: 'POST',
			headers: bearer(user.jwt),
			body: form,
		});
		expect(upload.status).toBe(200);
		const uploadedAt = Date.now();
		const me = await api(app, '/api/users/me?populate=avatar', { headers: bearer(user.jwt) });
		const { avatar }: { avatar: { url: string } | null } = await me.json();
		if (!avatar) throw new Error('user has no avatar after upload');
		const fileName = basename(avatar.url);

		// serve.sh runs the cron every 10 s; the export runs inside the server, so it must not stop it.
		await expect
			.poll(
				async () =>
					(await newestArchiveEntries(uploadedAt)).some((entry) => entry.endsWith(`/${fileName}`)),
				{ timeout: 60_000 },
			)
			.toBe(true);

		const health = await api(app, '/_health');
		expect(health.status).toBe(204);
	},
);
