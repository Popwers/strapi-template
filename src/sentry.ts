import type { Core } from '@strapi/strapi';

import type { CheckInClient } from './backup-monitor';

const sendError = (strapi: Core.Strapi, error: Error) => {
	if (process.env.NODE_ENV === 'production') {
		if (strapi.plugin('sentry')?.service('sentry')) {
			try {
				strapi.plugin('sentry').service('sentry').sendError(error);
			} catch (error) {
				strapi.log.error('Error sending error to Sentry', error);
			}
		}
	}
};

/**
 * The Sentry SDK the plugin initialized, for cron check-ins.
 * @param strapi - The running Strapi instance.
 * @returns The SDK, or undefined outside production or without a DSN.
 */
export const sentryCheckIns = (strapi: Core.Strapi): CheckInClient | undefined => {
	if (process.env.NODE_ENV !== 'production') return undefined;
	const instance: CheckInClient | null | undefined = strapi
		.plugin('sentry')
		?.service('sentry')
		?.getInstance();
	return instance ?? undefined;
};

export default sendError;
