import { expect, test } from 'e2e';

import { api, BACKUP_BUCKET, S3_PORT } from './support';

/**
 * Lists the keys of the mock backups bucket.
 * @returns Every object key, in listing order.
 */
async function listBackupKeys(): Promise<string[]> {
	const response = await fetch(`http://127.0.0.1:${S3_PORT}/${BACKUP_BUCKET}/?list-type=2`);
	const listing = await response.text();
	return [...listing.matchAll(/<Key>([^<]+)<\/Key>/g)].map((match) => match[1] ?? '');
}

test(
	'the backup cron uploads a Strapi archive and the server keeps serving',
	{ timeout: 90_000 },
	async ({ app }) => {
		// serve.sh runs the cron every 10 s; the export runs inside the server, so it must not stop it.
		await expect
			.poll(
				async () => (await listBackupKeys()).some((key) => /^backup-strapi-\d+\.tar\.gz$/.test(key)),
				{
					timeout: 60_000,
				},
			)
			.toBe(true);

		const health = await api(app, '/_health');
		expect(health.status).toBe(204);
	},
);
