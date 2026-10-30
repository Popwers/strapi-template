import { expect, test } from 'e2e';

import { api, FRONT_ORIGIN } from './support';

const FOREIGN_ORIGIN = 'https://example.com';

test('an allowed front origin is echoed back with credentials', async ({ app }) => {
	const response = await api(app, '/_health', { headers: { origin: FRONT_ORIGIN } });

	expect(response.headers.get('access-control-allow-origin')).toBe(FRONT_ORIGIN);
	expect(response.headers.get('access-control-allow-credentials')).toBe('true');
});

test('another origin gets no Access-Control-Allow-Origin', async ({ app }) => {
	const response = await api(app, '/_health', { headers: { origin: FOREIGN_ORIGIN } });

	expect(response.headers.get('access-control-allow-origin')).toBeNull();
});

test('a preflight from another origin is not granted', async ({ app }) => {
	const response = await api(app, '/api/auth/local', {
		method: 'OPTIONS',
		headers: {
			origin: FOREIGN_ORIGIN,
			'access-control-request-method': 'POST',
			'access-control-request-headers': 'content-type',
		},
	});

	expect(response.headers.get('access-control-allow-origin')).toBeNull();
});

test('a preflight from the allowed front origin is granted', async ({ app }) => {
	const response = await api(app, '/api/auth/local', {
		method: 'OPTIONS',
		headers: {
			origin: FRONT_ORIGIN,
			'access-control-request-method': 'POST',
			'access-control-request-headers': 'content-type',
		},
	});

	expect(response.headers.get('access-control-allow-origin')).toBe(FRONT_ORIGIN);
});
