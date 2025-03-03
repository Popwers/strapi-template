import type { Core } from '@strapi/strapi';

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

export default sendError;
