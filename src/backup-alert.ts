import type { Core } from '@strapi/strapi';

/** One backup step that did not land, and why. */
export interface BackupFailure {
	step: string;
	reason: string;
}

/**
 * Mails one alert to `BACKUP_ALERT_EMAIL_TO` for a backup run with failed steps, through the email
 * plugin (the project's SMTP). With a 3-day retention, three silent failures leave no backup. The
 * project standard keeps this out of Sentry: the plan has a single cron monitor slot. A mail that
 * cannot be sent is logged and never throws into the backup cron.
 * @param strapi - The running Strapi instance.
 * @param failures - The steps that failed in this run.
 */
export async function alertBackupFailure(strapi: Core.Strapi, failures: BackupFailure[]): Promise<void> {
	const to = process.env.BACKUP_ALERT_EMAIL_TO;
	if (!to) {
		strapi.log.error('Backup failed and BACKUP_ALERT_EMAIL_TO is unset: no alert was sent');
		return;
	}
	const site = process.env.PUBLIC_URL ?? 'Strapi';
	try {
		await strapi
			.plugin('email')
			.service('email')
			.send({
				to,
				subject: `Backup failed: ${site}`,
				text: [
					`The backup of ${site} did not complete at ${new Date().toISOString()}.`,
					'',
					...failures.map((failure) => `- ${failure.step}: ${failure.reason}`),
					'',
					'Backups older than 3 days expire: check the server logs before the last one goes.',
				].join('\n'),
			});
	} catch (error) {
		strapi.log.error('Backup alert e-mail failed:', error);
	}
}
