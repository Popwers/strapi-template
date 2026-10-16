import favicon from './extensions/favicon.png';

export default {
	config: {
		locales: ['fr', 'fr-FR', 'en'],
		head: {
			favicon: favicon,
		},
		auth: {
			logo: favicon,
		},
		menu: {
			logo: favicon,
		},
		tutorials: false,
		notifications: { releases: false },
	},
};
