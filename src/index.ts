import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Core } from '@strapi/strapi';

import sendError from './sentry';

/**
 * Reads a required environment variable, throwing if it is missing or empty.
 * Narrows the return type to `string`, since `process.env[name]` is otherwise
 * `string | undefined`.
 * @param name - The environment variable to read.
 * @returns The environment variable's value.
 */
function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
}

export default {
	register(_context: { strapi: Core.Strapi }) {},

	bootstrap({ strapi }: { strapi: Core.Strapi }) {
		strapi.cron.add({
			backup: {
				task: async ({ strapi }) => {
					if (process.env.NODE_ENV === 'development') return;

					const EXPORT_FILE_NAME = `name-of-your-company-strapi-backup-${Date.now()}`;
					const BACKUP_FILE = `${EXPORT_FILE_NAME}.tar.gz`;
					const DB_BACKUP_FILE = `${EXPORT_FILE_NAME}-db.sql`;

					try {
						const S3_ENDPOINT = requireEnv('S3_ENDPOINT');
						const S3_ACCESS_KEY_ID = requireEnv('S3_ACCESS_KEY_ID');
						const S3_SECRET_ACCESS_KEY = requireEnv('S3_SECRET_ACCESS_KEY');
						const S3_BUCKET = requireEnv('S3_BUCKET');
						const DATABASE_HOST = requireEnv('DATABASE_HOST');
						const DATABASE_PORT = requireEnv('DATABASE_PORT');
						const DATABASE_NAME = requireEnv('DATABASE_NAME');
						const DATABASE_USERNAME = requireEnv('DATABASE_USERNAME');
						const DATABASE_PASSWORD = requireEnv('DATABASE_PASSWORD');

						const S3_CONFIG = {
							region: 'auto',
							endpoint: S3_ENDPOINT,
							credentials: {
								accessKeyId: S3_ACCESS_KEY_ID,
								secretAccessKey: S3_SECRET_ACCESS_KEY,
							},
						};

						const s3Client = new S3Client(S3_CONFIG);

						strapi.log.info('Starting backup process...');

						strapi.log.info('Creating database dump...');
						// execFileSync (no shell) so env values are passed as plain arguments.
						execFileSync(
							'pg_dump',
							[
								`--host=${DATABASE_HOST}`,
								`--port=${DATABASE_PORT}`,
								`--username=${DATABASE_USERNAME}`,
								'--no-owner',
								'--no-privileges',
								`--file=${DB_BACKUP_FILE}`,
								DATABASE_NAME,
							],
							{
								stdio: 'inherit',
								timeout: 300000,
								env: {
									...process.env,
									PGPASSWORD: DATABASE_PASSWORD,
								},
							},
						);

						strapi.log.info('Exporting Strapi data...');

						// execFileSync (no shell) so the filename is never interpreted by /bin/sh,
						// matching the pg_dump call above and removing a latent injection sink.
						execFileSync('strapi', ['export', '--no-encrypt', '-f', EXPORT_FILE_NAME], {
							stdio: 'inherit',
							timeout: 300000,
						});

						strapi.log.info('Uploading backups to S3...');
						const strapiBackup = fs.readFileSync(BACKUP_FILE);
						const dbBackup = fs.readFileSync(DB_BACKUP_FILE);

						await Promise.all([
							s3Client.send(
								new PutObjectCommand({
									Bucket: S3_BUCKET,
									Key: BACKUP_FILE,
									Body: strapiBackup,
									ContentType: 'application/gzip',
								}),
							),
							s3Client.send(
								new PutObjectCommand({
									Bucket: S3_BUCKET,
									Key: DB_BACKUP_FILE,
									Body: dbBackup,
									ContentType: 'application/sql',
								}),
							),
						]);

						strapi.log.info('Backup completed successfully');
					} catch (error) {
						strapi.log.error('Backup failed:', error);
						sendError(strapi, error);
					} finally {
						try {
							const filesToCleanup = [BACKUP_FILE, DB_BACKUP_FILE];
							for (const file of filesToCleanup) {
								if (fs.existsSync(file)) fs.unlinkSync(file);
							}
							strapi.log.info('Cleaned up temporary backup files');
						} catch (cleanupError) {
							strapi.log.error('Failed to cleanup temporary files:', cleanupError);
							sendError(strapi, cleanupError);
						}

						strapi.log.info('Backup process finished');
					}
				},
				options: {
					rule: process.env.CRON_SCHEDULE || '0 */6 * * *',
				},
			},
		});
	},
};
