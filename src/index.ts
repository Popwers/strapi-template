import type { Core } from '@strapi/strapi';

import { assertDurableUploadStorage } from '../config/upload-storage';
import { runBackup } from './backup';
import { backupMonitorConfig, monitorBackup } from './backup-monitor';
import { stampPasswordChanges } from './extensions/users-permissions/password-change';
import sendError, { sentryCheckIns } from './sentry';

let isBackupRunning = false;

export default {
	register(_context: { strapi: Core.Strapi }) {
		assertDurableUploadStorage();
	},

	bootstrap({ strapi }: { strapi: Core.Strapi }) {
		stampPasswordChanges(strapi);

		const backupSchedule = process.env.CRON_SCHEDULE || '0 */6 * * *';
		// `strapi.cron` schedules in the server's timezone; the monitor must expect runs in the same.
		const monitorConfig = backupMonitorConfig(
			backupSchedule,
			Intl.DateTimeFormat().resolvedOptions().timeZone,
		);
		strapi.cron.add({
			backup: {
				task: async ({ strapi }) => {
					if (process.env.NODE_ENV === 'development') return;
					// A slow run must not overlap the next tick and dump twice at once.
					if (isBackupRunning) {
						strapi.log.warn('Backup skipped: the previous run is still going');
						return;
					}
					isBackupRunning = true;
					try {
						// Each failed step is already sent to Sentry; the check-ins add the heartbeat.
						await monitorBackup(
							sentryCheckIns(strapi),
							monitorConfig,
							() => runBackup(strapi),
							(error) => strapi.log.warn('Backup monitor check-in failed:', error),
						);
					} catch (error) {
						strapi.log.error('Backup failed:', error);
						sendError(strapi, error);
					} finally {
						isBackupRunning = false;
					}
				},
				options: {
					rule: backupSchedule,
				},
			},
		});
	},
};
