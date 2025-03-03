const _ = require('lodash');

const parseFiles = files => {
	const parsed = Object.keys(files).reduce((acc, key) => {
		const fullPath = _.toPath(key);

		if (fullPath.length <= 1 || fullPath[0] !== 'files') {
			return acc;
		}

		const path = _.tail(fullPath);
		acc[path.join('.')] = files[key];
		return acc;
	}, {});
	return parsed;
};

const generateUser = () => {
	const randomString = Math.random().toString(36).substring(2, 10);
	return `username_${randomString}`;
};

export { generateUser, parseFiles };
