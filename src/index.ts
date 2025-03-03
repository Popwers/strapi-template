import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Core } from '@strapi/strapi';
import sendError from './sentry';

export default {
	/**
	 * An asynchronous register function that runs before
	 * your application is initialized.
	 *
	 * This gives you an opportunity to extend code.
	 */
	register({ strapi }: { strapi: Core.Strapi }) {},

	/**
	 * An asynchronous bootstrap function that runs before
	 * your application gets started.
	 *
	 * This gives you an opportunity to set up your data model,
	 * run jobs, or perform some special logic.
	 */
	bootstrap({ strapi }: { strapi: Core.Strapi }) {
		/**
		 * Add a cron job to the Strapi instance to backup all data
		 * The archive will be stored in the R2 storage
		 * The backup will be done every 3 hours
		 */
		strapi.cron.add({
			backup: {
				task: async ({ strapi }) => {
					// Disable on dev mode
					if (process.env.NODE_ENV === 'development') return;

					const EXPORT_FILE_NAME = `name-of-your-company-strapi-backup-${Date.now()}`;
					const BACKUP_FILE = `${EXPORT_FILE_NAME}.tar.gz`;
					const DB_BACKUP_FILE = `${EXPORT_FILE_NAME}-db.sql`;

					try {
						// Validate environment variables
						const requiredEnvVars = [
							'S3_ENDPOINT',
							'S3_ACCESS_KEY_ID',
							'S3_SECRET_ACCESS_KEY',
							'S3_BUCKET',
							'DATABASE_HOST',
							'DATABASE_PORT',
							'DATABASE_NAME',
							'DATABASE_USERNAME',
							'DATABASE_PASSWORD',
						];

						for (const envVar of requiredEnvVars) {
							if (!process.env[envVar])
								throw new Error(`Missing required environment variable: ${envVar}`);
						}

						const S3_CONFIG = {
							region: 'auto',
							endpoint: process.env.S3_ENDPOINT,
							credentials: {
								accessKeyId: process.env.S3_ACCESS_KEY_ID,
								secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
							},
						};

						const s3Client = new S3Client(S3_CONFIG);

						strapi.log.info('Starting backup process...');

						// Create MySQL database dump
						strapi.log.info('Creating database dump...');
						execSync(
							`mysqldump --host=${process.env.DATABASE_HOST} --port=${process.env.DATABASE_PORT} --user=${process.env.DATABASE_USERNAME} ${process.env.DATABASE_NAME} > ${DB_BACKUP_FILE}`,
							{
								stdio: 'inherit',
								timeout: 300000,
								env: {
									...process.env,
									MYSQL_PWD: process.env.DATABASE_PASSWORD,
								},
							}
						);

						// Export Strapi data
						strapi.log.info('Exporting Strapi data...');

						execSync(`strapi export --no-encrypt -f ${EXPORT_FILE_NAME}`, {
							stdio: 'inherit',
							timeout: 300000,
						});

						// Upload both files to S3
						strapi.log.info('Uploading backups to S3...');
						const strapiBackup = fs.readFileSync(BACKUP_FILE);
						const dbBackup = fs.readFileSync(DB_BACKUP_FILE);

						await Promise.all([
							s3Client.send(
								new PutObjectCommand({
									Bucket: process.env.S3_BUCKET,
									Key: BACKUP_FILE,
									Body: strapiBackup,
									ContentType: 'application/gzip',
								})
							),
							s3Client.send(
								new PutObjectCommand({
									Bucket: process.env.S3_BUCKET,
									Key: DB_BACKUP_FILE,
									Body: dbBackup,
									ContentType: 'application/sql',
								})
							),
						]);

						strapi.log.info('Backup completed successfully');
					} catch (error) {
						strapi.log.error('Backup failed:', error);
						sendError(strapi, error);
					} finally {
						// Cleanup both temporary files
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
