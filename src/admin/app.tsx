import favicon from './extensions/favicon.png';

export default {
	config: {
		locales: ['fr', 'fr-FR', 'en'],
		// Add the favicon in the head of the admin panel
		head: {
			favicon: favicon,
		},
		auth: {
			logo: favicon,
		},
		menu: {
			logo: favicon,
		},
		// Disable video tutorials
		tutorials: false,
		// Disable notifications about new Strapi releases
		notifications: { releases: false },
	},
};
