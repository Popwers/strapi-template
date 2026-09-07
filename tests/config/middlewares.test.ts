import { describe, expect, test } from 'bun:test';

import middlewares from '../../config/middlewares';

type MiddlewareEntry = (typeof middlewares)[number];

function isMiddlewareName(entry: MiddlewareEntry): entry is string {
	return typeof entry === 'string';
}

const middlewareKey = (entry: MiddlewareEntry): string => {
	if (isMiddlewareName(entry)) return entry;
	return entry.resolve;
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
