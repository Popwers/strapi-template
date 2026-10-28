import type { Core } from '@strapi/strapi';

import { assertDurableUploadStorage } from '../config/upload-storage';
import { runBackup } from './backup';
import sendError from './sentry';

let isBackupRunning = false;

export default {
	register(_context: { strapi: Core.Strapi }) {
		assertDurableUploadStorage();
	},

	bootstrap({ strapi }: { strapi: Core.Strapi }) {
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
						await runBackup(strapi);
					} catch (error) {
						strapi.log.error('Backup failed:', error);
						sendError(strapi, error);
					} finally {
						isBackupRunning = false;
					}
				},
				options: {
					rule: process.env.CRON_SCHEDULE || '0 */6 * * *',
				},
			},
		});
	},
};
