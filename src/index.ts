import type { Core } from '@strapi/strapi';

import { assertDurableUploadStorage } from '../config/upload-storage';
import { runBackup } from './backup';
import { alertBackupFailure } from './backup-alert';
import { guardMemberWrites } from './extensions/users-permissions/member-writes';
import { stampPasswordChanges } from './extensions/users-permissions/password-change';
import { stampResetCodes } from './extensions/users-permissions/reset-code';

let isBackupRunning = false;

export default {
	register(_context: { strapi: Core.Strapi }) {
		assertDurableUploadStorage();
	},

	async bootstrap({ strapi }: { strapi: Core.Strapi }) {
		stampPasswordChanges(strapi);
		stampResetCodes(strapi);
		guardMemberWrites(strapi);
		// The upload plugin creates the "API Uploads" folder on the first API upload; two first
		// uploads at once both insert it and one fails on its unique index. Create it once here.
		await strapi.plugin('upload').service('api-upload-folder').getAPIUploadFolder();

		const backupSchedule = process.env.CRON_SCHEDULE || '0 */6 * * *';
		if (process.env.NODE_ENV === 'production' && !process.env.BACKUP_ALERT_EMAIL_TO) {
			strapi.log.warn('BACKUP_ALERT_EMAIL_TO is unset: a failed backup will only be logged');
		}
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
						const failures = await runBackup(strapi);
						if (failures.length > 0) await alertBackupFailure(strapi, failures);
					} catch (error) {
						strapi.log.error('Backup failed:', error);
						const reason = error instanceof Error ? error.message : String(error);
						await alertBackupFailure(strapi, [{ step: 'backup run', reason }]);
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
