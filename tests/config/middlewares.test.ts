import { describe, expect, test } from 'bun:test';

import middlewares from '../../config/middlewares';

type MiddlewareEntry = (typeof middlewares)[number];

function isMiddlewareName(entry: MiddlewareEntry): entry is string {
	return typeof entry === 'string';
}

const middlewareKey = (entry: MiddlewareEntry): string => {
	if (isMiddlewareName(entry)) return entry;
	return 'resolve' in entry ? entry.resolve : entry.name;
};

describe('middleware stack order', () => {
	test('compression is registered before favicon so favicon bodies are compressed', () => {
		const keys = middlewares.map(middlewareKey);
		const compression = keys.indexOf('strapi::compression');
		const favicon = keys.indexOf('strapi::favicon');

		expect(compression).toBeGreaterThan(-1);
		expect(favicon).toBeGreaterThan(-1);
		expect(compression).toBeLessThan(favicon);
	});
});

describe('cors', () => {
	test('is configured with an explicit origin list, never the wildcard default', () => {
		const cors = middlewares.find(
			(entry) => !isMiddlewareName(entry) && 'name' in entry && entry.name === 'strapi::cors',
		);

		expect(cors).toBeDefined();
		if (cors === undefined || isMiddlewareName(cors) || !('config' in cors)) return;
		if (!('origin' in cors.config)) throw new Error('strapi::cors has no origin');
		expect(cors.config.origin.length).toBeGreaterThan(0);
		expect(cors.config.origin).not.toContain('*');
	});
});
