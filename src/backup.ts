import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { engine, file, strapi as strapiTransfer } from '@strapi/data-transfer';
import type { Core } from '@strapi/strapi';

import sendError from './sentry';

const execFileAsync = promisify(execFile);

/** Each step gets 5 minutes before it is reported as failed. */
const STEP_TIMEOUT_MS = 300_000;

/** One file produced by a backup step, uploaded under `key`. */
interface BackupArtifact {
	filePath: string;
	key: string;
	contentType: string;
}

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

/**
 * Dumps the database with `pg_dump` (from `postgresql-client` in the image), off the event loop.
 * @param filePath - Where the SQL dump is written.
 */
async function dumpDatabase(filePath: string): Promise<void> {
	await execFileAsync(
		'pg_dump',
		[
			`--host=${requireEnv('DATABASE_HOST')}`,
			`--port=${requireEnv('DATABASE_PORT')}`,
			`--username=${requireEnv('DATABASE_USERNAME')}`,
			'--no-owner',
			'--no-privileges',
			`--file=${filePath}`,
			requireEnv('DATABASE_NAME'),
		],
		{
			timeout: STEP_TIMEOUT_MS,
			env: { ...process.env, PGPASSWORD: requireEnv('DATABASE_PASSWORD') },
		},
	);
}

/**
 * Exports content, files and config to a `.tar.gz` archive, what `strapi export --no-encrypt` does,
 * inside the running server: the CLI is not on the image's PATH and would boot a second Strapi.
 * @param strapi - The running Strapi instance.
 * @param basePath - The archive path without its extension.
 * @returns The path of the written archive.
 */
async function exportStrapiArchive(strapi: Core.Strapi, basePath: string): Promise<string> {
	const source = strapiTransfer.providers.createLocalStrapiSourceProvider({
		getStrapi: () => strapi,
		// The provider destroys the instance it read from by default: that is the live server.
		autoDestroy: false,
	});
	const destination = file.providers.createLocalFileDestinationProvider({
		file: { path: basePath },
		encryption: { enabled: false },
		compression: { enabled: true },
	});
	const transfer = engine.createTransferEngine(source, destination, {
		versionStrategy: 'ignore',
		schemaStrategy: 'ignore',
	});
	const results = await transfer.transfer();
	const archivePath = results.destination?.file?.path;
	if (archivePath === undefined || !fs.existsSync(archivePath)) {
		throw new Error(`Strapi export wrote no archive at ${basePath}`);
	}
	return archivePath;
}

/**
 * Uploads one artifact to the backups bucket, streamed from disk.
 * @param s3Client - The R2 client.
 * @param artifact - The file and the key it is stored under.
 */
async function uploadArtifact(s3Client: S3Client, artifact: BackupArtifact): Promise<void> {
	await s3Client.send(
		new PutObjectCommand({
			Bucket: requireEnv('S3_BUCKET'),
			Key: artifact.key,
			Body: fs.createReadStream(artifact.filePath),
			ContentLength: fs.statSync(artifact.filePath).size,
			ContentType: artifact.contentType,
		}),
	);
}

/**
 * Runs one backup: a database dump and a Strapi archive, each uploaded to `<name>-backups` under
 * `BACKUP_KEY_PREFIX` (the prefix the 3-day lifecycle rule expires). The two steps are independent:
 * one failing is reported and the other still lands.
 * @param strapi - The running Strapi instance.
 */
export async function runBackup(strapi: Core.Strapi): Promise<void> {
	const timestamp = Date.now();
	const prefix = process.env.BACKUP_KEY_PREFIX ?? 'backup-';
	const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-backup-'));
	const s3Client = new S3Client({
		region: 'auto',
		endpoint: requireEnv('S3_ENDPOINT'),
		// `<account>.eu.r2.cloudflarestorage.com/<bucket>`, no per-bucket subdomain.
		forcePathStyle: true,
		credentials: {
			accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
			secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
		},
	});

	const steps: { name: string; produce: () => Promise<BackupArtifact> }[] = [
		{
			name: 'database dump',
			produce: async () => {
				const filePath = path.join(workDir, 'db.sql');
				await dumpDatabase(filePath);
				return { filePath, key: `${prefix}db-${timestamp}.sql`, contentType: 'application/sql' };
			},
		},
		{
			name: 'Strapi export',
			produce: async () => ({
				filePath: await exportStrapiArchive(strapi, path.join(workDir, 'strapi')),
				key: `${prefix}strapi-${timestamp}.tar.gz`,
				contentType: 'application/gzip',
			}),
		},
	];

	strapi.log.info('Starting backup process...');
	try {
		for (const step of steps) {
			try {
				const artifact = await step.produce();
				await uploadArtifact(s3Client, artifact);
				strapi.log.info(`Backup ${step.name} uploaded to ${artifact.key}`);
			} catch (error) {
				strapi.log.error(`Backup ${step.name} failed:`, error);
				sendError(strapi, error);
			}
		}
	} finally {
		fs.rmSync(workDir, { recursive: true, force: true });
		strapi.log.info('Backup process finished');
	}
}
